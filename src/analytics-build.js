'use strict';
const crypto = require('node:crypto');
const { indexingEnabled } = require('./seo-safety');

const MEASUREMENT_ID = 'G-BTK39BBNRE';
const SITE = 'https://www.mft.care';
const ENABLE_FLAG = 'GA4_BASIC_MEASUREMENT_ENABLED';

const SENSITIVE_PATHS = [
  /^\/marriage-reset-assessment(?:\/|$)/,
  /^\/portal(?:\/|$)/,
  /^\/patient(?:\/|$)/,
  /^\/intake(?:\/|$)/,
  /^\/assessment(?:\/|$)/,
  /^\/insurance(?:\/|$)/,
  /^\/appointment(?:\/|$)/
];

function enabled(env = process.env) {
  return indexingEnabled(env) && /^true$/i.test(String(env[ENABLE_FLAG] || ''));
}
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
function pageKey(route) {
  return crypto.createHash('sha256').update(normalizeRoute(route)).digest('hex').slice(0,16);
}
function inject(html, route, allowedRoutes, env = process.env) {
  const p = normalizeRoute(route);
  if (!enabled(env) || !allowedRoutes.has(p) || isSensitive(p)) return { html, injected: false, reason: 'disabled-or-not-approved' };
  if (/G-BTK39BBNRE|mft-analytics\.js/.test(html)) throw new Error('Existing Google Analytics integration detected; refusing duplicate installation');
  const tag = '<script src="/assets/mft-analytics.js" defer data-mft-measurement-id="' + MEASUREMENT_ID +
    '" data-mft-page-key="' + pageKey(p) + '"></script>';
  if (!html.includes('</body>')) throw new Error('Missing closing body tag for analytics injection: ' + p);
  return { html: html.replace('</body>', tag + '</body>'), injected: true, reason: 'approved-production-page' };
}
module.exports = { MEASUREMENT_ID, SITE, ENABLE_FLAG, enabled, normalizeRoute, isSensitive, pageKey, inject };
