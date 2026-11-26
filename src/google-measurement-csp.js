'use strict';

// The default deployment denies Google. A reviewed conditional build can add
// these exact destinations to its HTTP policy; all other HTML documents also
// receive the original, stricter policy at the start of <head>. Browsers apply
// the intersection, avoiding assumptions about overlapping Netlify headers.
const SCRIPT_ORIGIN = 'https://www.googletagmanager.com';
// A GA4 tag linked to Ads has native measurement/identifier destinations beyond
// google-analytics.com. These are explicit in the unapproved flow and the real
// vendor probe; a hostname is not evidence that personalization is enabled.
const COLLECT_ORIGINS = ['https://analytics.google.com', 'https://www.google-analytics.com',
  'https://region1.google-analytics.com', 'https://www.google.com',
  'https://stats.g.doubleclick.net', SCRIPT_ORIGIN];
const META_MARKER = 'data-mft-google-denied="true"';
function headerPolicy(headers) {
  const matches = [...headers.matchAll(/^\s+Content-Security-Policy:\s*([^\n]+)$/gm)];
  if (matches.length !== 1) throw Error('Expected one shared Content-Security-Policy header');
  return matches[0][1];
}
function permitGoogle(headers) {
  const original = headerPolicy(headers);
  if (!/script-src [^;]+;/.test(original) || !/connect-src [^;]+;/.test(original) || !/img-src [^;]+;/.test(original))
    throw Error('Missing script, connect or image CSP directive');
  const workers = [...original.matchAll(/(?:^|;\s*)worker-src\s+([^;]*)(?=;|$)/g)];
  if (workers.length > 1 || workers.some(match => match[1].trim() !== "'none'"))
    throw Error('Google CSP must disable workers from first load');
  let allowed = original.replace(/script-src ([^;]+);/, 'script-src $1 '+SCRIPT_ORIGIN+';')
    .replace(/connect-src ([^;]+);/, 'connect-src $1 '+COLLECT_ORIGINS.join(' ')+';')
    .replace(/img-src ([^;]+);/, 'img-src $1 '+COLLECT_ORIGINS.join(' ')+';');
  // A later stop policy cannot change a worker's inherited policy snapshot.
  // Prevent vendor worker contexts before any Google script can run.
  if (!workers.length) allowed += (allowed.trimEnd().endsWith(';') ? ' ' : '; ')+"worker-src 'none';";
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
