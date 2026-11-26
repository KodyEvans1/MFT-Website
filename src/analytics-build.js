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
const GOOGLE_FLOW_FILE = 'content/google-measurement-flow.json';
const GOOGLE_RUNTIME_ASSET = 'mft-google-measurement.js';
const GOOGLE_RUNTIME_MODE = 'approved-main-page';
const GOOGLE_EVENT = 'simplepractice_exit';
const CANDIDATE_GOOGLE_ROUTES = Object.freeze(['/', '/about/']);
const REVIEWED_DOCUMENT_TITLES = Object.freeze({
  '/': 'Marriage.Family.Therapy | Woodinville & Online in Washington',
  '/about/': 'About Marriage.Family.Therapy | Woodinville, WA'
});
const fullHash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function flowHash() { return fullHash(fs.readFileSync(path.join(__dirname, '..', GOOGLE_FLOW_FILE))); }
function runtimeHash() { return fullHash(fs.readFileSync(path.join(__dirname, 'assets', GOOGLE_RUNTIME_ASSET))); }
function validateReviewedDocumentTitles(titles) {
  if (!titles || typeof titles !== 'object' || Array.isArray(titles) ||
      Object.keys(titles).length !== CANDIDATE_GOOGLE_ROUTES.length ||
      CANDIDATE_GOOGLE_ROUTES.some(route => !Object.hasOwn(titles, route) || titles[route] !== REVIEWED_DOCUMENT_TITLES[route]))
    throw new Error('Unsupported Google measurement flow: exact reviewed document titles are required');
  return Object.freeze({...titles});
}
function reviewedDocumentTitles() {
  return validateReviewedDocumentTitles(JSON.parse(fs.readFileSync(path.join(__dirname, '..', GOOGLE_FLOW_FILE), 'utf8')).reviewedDocumentTitles);
}
function assertReviewedDocumentTitle(html, route) {
  const expected = reviewedDocumentTitles()[normalizeRoute(route)];
  // Only the known canonical title markup is accepted. Ignore comments and
  // inactive/raw-text containers so a quoted title cannot stand in for the
  // document title. The runtime independently checks document.title as well.
  const markup = html.replace(/<!--[\s\S]*?-->|<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  const heads = [...markup.matchAll(/<head(?:\s[^>]*)?>([\s\S]*?)<\/head\s*>/gi)];
  const titles = [...markup.matchAll(/<title\b[^>]*>[\s\S]*?<\/title\s*>/gi)];
  const canonical = expected && '<title>'+expected.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')+'</title>';
  if (!expected || heads.length !== 1 || titles.length !== 1 || titles[0][0] !== canonical || !heads[0][1].includes(canonical))
    throw new Error('Google measurement document title differs from the reviewed scope: '+normalizeRoute(route));
  return expected;
}

function validateGooglePolicy(policy) {
  const keys = ['version', 'status', 'approvedRoutes', 'approvedEvents', 'reason', 'review'];
  if (!policy || typeof policy !== 'object' || Array.isArray(policy) ||
      Object.keys(policy).length !== keys.length || keys.some(key => !Object.hasOwn(policy, key)) ||
      policy.version !== 2 || !['blocked-sensitive-context', 'approved-reviewed-scope'].includes(policy.status) ||
      !Array.isArray(policy.approvedRoutes) || !Array.isArray(policy.approvedEvents) ||
      typeof policy.reason !== 'string' || !policy.reason.trim() || policy.reason.length > 500)
    throw new Error('Unsupported Google measurement policy');
  if (policy.status === 'blocked-sensitive-context') {
    if (policy.approvedRoutes.length || policy.approvedEvents.length || policy.review !== null)
      throw new Error('Unsupported Google measurement policy: a blocked policy cannot approve collection');
  } else {
    const review = policy.review;
    const reviewKeys = ['decision', 'decisionReference', 'flowSha256', 'runtimeSha256', 'networkEvidenceSha256'];
    if (!policy.approvedRoutes.length || new Set(policy.approvedRoutes).size !== policy.approvedRoutes.length ||
        policy.approvedRoutes.some(route => !CANDIDATE_GOOGLE_ROUTES.includes(route)) ||
        policy.approvedEvents.length !== 1 || policy.approvedEvents[0] !== GOOGLE_EVENT ||
        !review || typeof review !== 'object' || Array.isArray(review) ||
        Object.keys(review).length !== reviewKeys.length || reviewKeys.some(key => !Object.hasOwn(review, key)) ||
        review.decision !== 'permitted' || typeof review.decisionReference !== 'string' ||
        !/^[A-Za-z0-9][A-Za-z0-9._:/ -]{7,199}$/.test(review.decisionReference) ||
        !/^[a-f0-9]{64}$/.test(review.networkEvidenceSha256 || '') ||
        review.flowSha256 !== flowHash() || review.runtimeSha256 !== runtimeHash())
      throw new Error('Unsupported Google measurement policy: matching flow, runtime and documented review evidence are required');
    reviewedDocumentTitles();
  }
  return Object.freeze({
    ...policy,
    approvedRoutes: Object.freeze([...policy.approvedRoutes]),
    approvedEvents: Object.freeze([...policy.approvedEvents]),
    review: policy.review ? Object.freeze({...policy.review}) : null
  });
}
const GOOGLE_POLICY = validateGooglePolicy(JSON.parse(fs.readFileSync(path.join(__dirname, '..', GOOGLE_POLICY_FILE), 'utf8')));
function googlePolicy() {
  return {...GOOGLE_POLICY, approvedRoutes:[...GOOGLE_POLICY.approvedRoutes], approvedEvents:[...GOOGLE_POLICY.approvedEvents], review:GOOGLE_POLICY.review?{...GOOGLE_POLICY.review}:null};
}
function googleReviewDigest(policy = GOOGLE_POLICY) {
  return policy.review ? fullHash(JSON.stringify(policy.review)) : null;
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

// Build flags cannot supply a missing data-use decision. The checked-in policy
// remains blocked. Synthetic approved policies are used only in isolated tests.
function enabled(env = process.env, policy = GOOGLE_POLICY) {
  return indexingEnabled(env) && handoffEnabled(env) && googleRequested(env) &&
    validateGooglePolicy(policy).status === 'approved-reviewed-scope';
}
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
function isGoogleEligible(route, event, policy = GOOGLE_POLICY) {
  return validateGooglePolicy(policy).status === 'approved-reviewed-scope' && policy.approvedRoutes.includes(normalizeRoute(route)) &&
    policy.approvedEvents.includes(event);
}
function pageKey(route) {
  return crypto.createHash('sha256').update(normalizeRoute(route)).digest('hex').slice(0,16);
}
// Generated pages must not inherit the analytics identity of a source template.
function strip(html) {
  return html.replace(/<script\b[^>]*src="[^"]*\/mft-(?:analytics|google-measurement|ga4-bootstrap|ga4-frame|ga4-page)\.js(?:\?[^"]*)?"[^>]*>[\s\S]*?<\/script>/gi, '');
}
function inject(html, route, allowedRoutes, env = process.env, policy = GOOGLE_POLICY) {
  const p = normalizeRoute(route);
  if (!controllerEnabled(env) || !allowedRoutes.has(p) || isSensitive(p) || /<(?:form|input|textarea)\b/i.test(html)) return { html, injected: false, reason: 'first-party-disabled-or-not-approved' };
  if (/G-BTK39BBNRE|mft-(?:analytics|google-measurement|ga4-bootstrap|ga4-frame|ga4-page)\.js|googletagmanager\.com|google-analytics\.com/.test(html)) throw new Error('Existing measurement integration detected; refusing duplicate installation');
  const google = enabled(env, policy) && isGoogleEligible(p, GOOGLE_EVENT, policy);
  if (google) assertReviewedDocumentTitle(html, p);
  const googleTag = google ? '<script src="/assets/' + GOOGLE_RUNTIME_ASSET + '?v=' + assetVersion(GOOGLE_RUNTIME_ASSET) +
    '" defer data-mft-google-mode="' + GOOGLE_RUNTIME_MODE + '" data-mft-google-measurement-id="' + MEASUREMENT_ID +
    '" data-mft-google-route="' + p + '" data-mft-google-event="' + GOOGLE_EVENT +
    '" data-mft-google-approved-review="' + googleReviewDigest(policy) + '"></script>' : '';
  const tag = '<script src="/assets/mft-analytics.js?v=' + assetVersion('mft-analytics.js') +
    '" defer data-mft-measurement-controller="first-party" data-mft-google-mode="' + (google ? GOOGLE_RUNTIME_MODE : 'disabled') +
    '" data-mft-page-key="' + pageKey(p) + '"' +
    ' data-mft-handoff-endpoint="' + HANDOFF_ENDPOINT + '"></script>';
  if (!html.includes('</body>')) throw new Error('Missing closing body tag for first-party controller injection: ' + p);
  return { html: html.replace('</body>', googleTag + tag + '</body>'), injected: true, googleInjected:google, reason: google ? 'reviewed-google-and-first-party-page' : 'approved-public-first-party-page' };
}
module.exports = { MEASUREMENT_ID, SITE, ENABLE_FLAG, HANDOFF_ENABLE_FLAG, HANDOFF_ENDPOINT, GOOGLE_POLICY_FILE,
  GOOGLE_FLOW_FILE, GOOGLE_RUNTIME_ASSET, GOOGLE_RUNTIME_MODE, GOOGLE_EVENT, CANDIDATE_GOOGLE_ROUTES, REVIEWED_DOCUMENT_TITLES,
  flowHash, runtimeHash, googleReviewDigest, validateReviewedDocumentTitles, reviewedDocumentTitles, assertReviewedDocumentTitle,
  enabled, handoffEnabled, controllerEnabled, googleRequested, googlePolicy, validateGooglePolicy, isGoogleEligible,
  normalizeRoute, isSensitive, pageKey, inject, assetVersion, strip, frameVersion };
