'use strict';

// The default deployment denies Google. A reviewed conditional build can add
// these exact destinations to its HTTP policy; all other HTML documents also
// receive the original, stricter policy at the start of <head>. Browsers apply
// the intersection, avoiding assumptions about overlapping Netlify headers.
const SCRIPT_ORIGIN = 'https://www.googletagmanager.com';
const COLLECT_ORIGINS = ['https://www.google-analytics.com', 'https://region1.google-analytics.com'];
const META_MARKER = 'data-mft-google-denied="true"';
function headerPolicy(headers) {
  const matches = [...headers.matchAll(/^\s+Content-Security-Policy:\s*([^\n]+)$/gm)];
  if (matches.length !== 1) throw Error('Expected one shared Content-Security-Policy header');
  return matches[0][1];
}
function permitGoogle(headers) {
  const original = headerPolicy(headers);
  if (!/script-src [^;]+;/.test(original) || !/connect-src [^;]+;/.test(original))
    throw Error('Missing script or connect CSP directive');
  const allowed = original.replace(/script-src ([^;]+);/, 'script-src $1 '+SCRIPT_ORIGIN+';')
    .replace(/connect-src ([^;]+);/, 'connect-src $1 '+COLLECT_ORIGINS.join(' ')+';');
  return {headers:headers.replace(original, allowed), restrictedPolicy:original};
}
function restrictedMeta(policy) {
  return '<meta '+META_MARKER+' http-equiv="Content-Security-Policy" content="'+
    policy.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'">';
}
function restrictHtml(html, policy) {
  if (html.includes(META_MARKER)) throw Error('Duplicate restricted Google CSP');
  if (!/<head(?:\s[^>]*)?>/i.test(html)) throw Error('Missing document head for restricted Google CSP');
  return html.replace(/<head(?:\s[^>]*)?>/i, '$&'+restrictedMeta(policy));
}
function removeGooglePermission(headers) {
  let result = headers;
  for (const origin of [SCRIPT_ORIGIN, ...COLLECT_ORIGINS]) result = result.split(' '+origin).join('');
  return result;
}
module.exports = {SCRIPT_ORIGIN, COLLECT_ORIGINS, META_MARKER, headerPolicy, permitGoogle, restrictedMeta, restrictHtml, removeGooglePermission};
