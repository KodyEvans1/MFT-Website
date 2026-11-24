'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs'), path = require('node:path');
function assetVersion(name) { return crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'assets',name))).digest('hex').slice(0,16); }
function frameVersion() { return crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'assets/mft-ga4-frame.js'))).update(fs.readFileSync(path.join(__dirname,'assets/mft-ga4-frame.html'))).digest('hex').slice(0,16); }
const { indexingEnabled } = require('./seo-safety');

const MEASUREMENT_ID = 'G-BTK39BBNRE';
const SITE = 'https://www.mft.care';
const ENABLE_FLAG = 'GA4_BASIC_MEASUREMENT_ENABLED';
const HANDOFF_ENABLE_FLAG = 'OPS_HANDOFF_COLLECTION_ENABLED';
const HANDOFF_ENDPOINT = 'https://ops.mft.care/api/marketing/attribution';
const GOOGLE_POLICY_FILE = 'content/google-measurement-policy.json';

function validateGooglePolicy(policy) {
  const keys = ['version', 'status', 'approvedRoutes', 'approvedEvents', 'reason'];
  if (!policy || typeof policy !== 'object' || Array.isArray(policy) ||
      Object.keys(policy).length !== keys.length || keys.some(key => !Object.hasOwn(policy, key)) ||
      policy.version !== 1 || policy.status !== 'blocked-sensitive-context' ||
      !Array.isArray(policy.approvedRoutes) || policy.approvedRoutes.length !== 0 ||
      !Array.isArray(policy.approvedEvents) || policy.approvedEvents.length !== 0 ||
      typeof policy.reason !== 'string' || !policy.reason.trim() || policy.reason.length > 500)
    throw new Error('Unsupported Google measurement policy; this release permits no Google routes or events');
  return Object.freeze({
    ...policy,
    approvedRoutes: Object.freeze([...policy.approvedRoutes]),
    approvedEvents: Object.freeze([...policy.approvedEvents])
  });
}
const GOOGLE_POLICY = validateGooglePolicy(JSON.parse(fs.readFileSync(path.join(__dirname, '..', GOOGLE_POLICY_FILE), 'utf8')));
function googlePolicy() {
  return {...GOOGLE_POLICY, approvedRoutes:[...GOOGLE_POLICY.approvedRoutes], approvedEvents:[...GOOGLE_POLICY.approvedEvents]};
}
function googleRequested(env = process.env) {
  return /^true$/i.test(String(env[ENABLE_FLAG] || ''));
}

const SENSITIVE_PATHS = [
  /^\/marriage-reset-assessment(?:\/|$)/,
  /^\/portal(?:\/|$)/,
  /^\/patient(?:\/|$)/,
  /^\/intake(?:\/|$)/,
  /^\/assessment(?:\/|$)/,
  /^\/insurance(?:\/|$)/,
  /^\/check-my-coverage(?:\/|$)/,
  /^\/marriagereset(?:\/|$)/,
  /^\/marriage-reset-access(?:\/|$)/,
  /^\/start(?:\/|$)/,
  /^\/appointment(?:\/|$)/
];

// A deployment flag cannot authorize sensitive-context measurement. This release
// has no Google sender and its explicit route/event approval lists are empty.
function enabled() { return false; }
function handoffEnabled(env = process.env) {
  return indexingEnabled(env) && /^true$/i.test(String(env[HANDOFF_ENABLE_FLAG] || ''));
}
function controllerEnabled(env = process.env) { return handoffEnabled(env); }
function normalizeRoute(route) {
  let p = String(route || '/').split(/[?#]/)[0] || '/';
  if (!p.startsWith('/')) p = '/' + p;
  if (p !== '/' && !p.endsWith('/')) p += '/';
  return p;
}
function isSensitive(route) {
  const p = normalizeRoute(route);
  return SENSITIVE_PATHS.some(re => re.test(p));
}
function isGoogleEligible(route, event) {
  return GOOGLE_POLICY.approvedRoutes.includes(normalizeRoute(route)) &&
    GOOGLE_POLICY.approvedEvents.includes(event);
}
function pageKey(route) {
  return crypto.createHash('sha256').update(normalizeRoute(route)).digest('hex').slice(0,16);
}
// Generated pages must not inherit the analytics identity of a source template.
function strip(html) {
  return html.replace(/<script\b[^>]*src="[^"]*\/mft-(?:analytics|ga4-bootstrap|ga4-frame|ga4-page)\.js(?:\?[^"]*)?"[^>]*>[\s\S]*?<\/script>/gi, '');
}
function inject(html, route, allowedRoutes, env = process.env) {
  const p = normalizeRoute(route);
  if (!controllerEnabled(env) || !allowedRoutes.has(p) || isSensitive(p) || /<(?:form|input|textarea)\b/i.test(html)) return { html, injected: false, reason: 'first-party-disabled-or-not-approved' };
  if (/G-BTK39BBNRE|mft-(?:analytics|ga4-bootstrap|ga4-frame|ga4-page)\.js|googletagmanager\.com|google-analytics\.com/.test(html)) throw new Error('Existing measurement integration detected; refusing duplicate installation');
  const tag = '<script src="/assets/mft-analytics.js?v=' + assetVersion('mft-analytics.js') +
    '" defer data-mft-measurement-controller="first-party" data-mft-google-mode="disabled' +
    '" data-mft-page-key="' + pageKey(p) + '"' +
    ' data-mft-handoff-endpoint="' + HANDOFF_ENDPOINT + '"></script>';
  if (!html.includes('</body>')) throw new Error('Missing closing body tag for first-party controller injection: ' + p);
  return { html: html.replace('</body>', tag + '</body>'), injected: true, reason: 'approved-public-first-party-page' };
}
module.exports = { MEASUREMENT_ID, SITE, ENABLE_FLAG, HANDOFF_ENABLE_FLAG, HANDOFF_ENDPOINT, GOOGLE_POLICY_FILE,
  enabled, handoffEnabled, controllerEnabled, googleRequested, googlePolicy, validateGooglePolicy, isGoogleEligible,
  normalizeRoute, isSensitive, pageKey, inject, assetVersion, strip, frameVersion };
