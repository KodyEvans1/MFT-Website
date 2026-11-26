'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { SITE, MEASUREMENT_ID, GOOGLE_POLICY_FILE, GOOGLE_RUNTIME_ASSET, enabled, handoffEnabled, controllerEnabled,
  googlePolicy, normalizeRoute, inject, assetVersion } = require('../src/analytics-build');
const { permitGoogle } = require('../src/google-measurement-csp');
const { LEGACY_BOOKING_MEASUREMENT_ENABLED, measurementReport } = require('../src/measurement-report');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const sitemapPath = path.join(dist, 'sitemap.xml');
const urls = fs.existsSync(sitemapPath)
  ? [...fs.readFileSync(sitemapPath,'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1])
  : [];
const allowedRoutes = new Set(urls.map(raw => {
  const u = new URL(raw);
  if (u.origin !== SITE) throw new Error('Analytics allowlist contains non-MFT origin: ' + raw);
  return normalizeRoute(u.pathname);
}));
const files=[];
(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())walk(f);else if(e.name==='index.html'||f.endsWith(path.sep+'404.html'))files.push(f);}})(dist);
const policy = googlePolicy();
const report={
  version:2,
  measurementId:MEASUREMENT_ID,
  measurementIdScope:enabled()?'reviewed Google destination; runtime requires a fresh advertising choice':'configured Google destination only; Google runtime is disabled',
  enabled:enabled(),
  enabledScope:'Google measurement runtime only',
  measurement:measurementReport(),
  approvalSource:GOOGLE_POLICY_FILE,
  allowedRoutes:policy.approvedRoutes,
  allowedEvents:policy.approvedEvents,
  controllerEnabled:controllerEnabled(),
  controllerApprovalSource:'production publication sitemap eligibility with sensitive-route and form exclusions; not Google approval',
  controllerAllowedRoutes:[...allowedRoutes].sort(),
  injectedScope:'first-party controller only',
  injected:[],excluded:[],googlePages:[]
};
// Enrich reports after booking decoration without changing the reviewed clinical
// rendering pipeline or its revision-specific approval fingerprint.
const bookingReportFile = path.join(dist, 'reports/booking-integration.json');
const bookingReport = JSON.parse(fs.readFileSync(bookingReportFile, 'utf8'));
if (bookingReport.measurementEnabled !== LEGACY_BOOKING_MEASUREMENT_ENABLED)
  throw new Error('Legacy booking collector state differs from the measurement contract');
bookingReport.measurementEnabledScope = 'legacy booking collector only';
bookingReport.measurement = report.measurement;
fs.writeFileSync(bookingReportFile, JSON.stringify(bookingReport, null, 2) + '\n');
fs.copyFileSync(path.join(root,'src/assets/mft-ga4-bootstrap.js'),path.join(dist,'assets/mft-ga4-bootstrap.js'));
fs.copyFileSync(path.join(root,'src/assets/mft-ga4-frame.js'),path.join(dist,'assets/mft-ga4-frame.js'));
fs.copyFileSync(path.join(root,'src/assets/mft-analytics.js'),path.join(dist,'assets/mft-analytics.js'));
fs.copyFileSync(path.join(root,'src/assets',GOOGLE_RUNTIME_ASSET),path.join(dist,'assets',GOOGLE_RUNTIME_ASSET));
fs.writeFileSync(path.join(dist,'assets/mft-ga4-frame.html'),fs.readFileSync(path.join(root,'src/assets/mft-ga4-frame.html'),'utf8').replace('__MFT_FRAME_SCRIPT_VERSION__',assetVersion('mft-ga4-frame.js')));
for(const file of files){
  const rel=path.relative(dist,file).split(path.sep).join('/');
  const route=rel==='index.html'?'/':'/'+rel.replace(/index\.html$/,'');
  const before=fs.readFileSync(file,'utf8');
  const result=inject(before,route,allowedRoutes);
  if(result.injected){fs.writeFileSync(file,result.html);report.injected.push(normalizeRoute(route));}
  else report.excluded.push({route:normalizeRoute(route),reason:result.reason});
  if(result.googleInjected)report.googlePages.push(normalizeRoute(route));
}
if(controllerEnabled()){
  let headers=fs.readFileSync(path.join(dist,'_headers'),'utf8');
  if(handoffEnabled())headers=headers.replace(/connect-src ([^;]+);/,"connect-src $1 https://ops.mft.care;");
  if(enabled())headers=permitGoogle(headers).headers;
  fs.writeFileSync(path.join(dist,'_headers'),headers);
  fs.appendFileSync(path.join(dist,'assets/styles.css'), '\n.mft-analytics-settings{font:inherit;font-size:.8rem;background:none;color:inherit;border:0;text-decoration:underline;text-underline-offset:.2em;cursor:pointer;padding:.5rem 0}\n');
  fs.appendFileSync(path.join(dist,'assets/styles.css'), `
.mft-analytics-consent{position:fixed;z-index:9999;left:1rem;right:1rem;bottom:1rem;max-width:720px;max-height:min(28rem,max(15rem,45vh),calc(100vh - 2rem));max-height:min(28rem,max(15rem,45svh),calc(100svh - 2rem));box-sizing:border-box;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:.8rem;margin:auto;padding:1rem 1.15rem;border:1px solid #b49554;border-radius:16px;background:#f7f3ea;color:#143d3a;box-shadow:0 16px 50px #0004;font:inherit}
.mft-analytics-consent p{min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable;margin:0;padding-right:.3rem}
.mft-analytics-consent-heading,.mft-analytics-consent-actions{display:flex;align-items:center;gap:.65rem}
.mft-analytics-consent-heading{justify-content:space-between}
.mft-analytics-consent-heading strong{line-height:1.35}
.mft-analytics-consent-actions{justify-content:flex-end;flex-wrap:wrap}
.mft-analytics-consent button{flex-shrink:0;font:inherit;border-radius:999px;padding:.55rem 1rem;border:1px solid #143d3a;background:#fff;color:#143d3a;cursor:pointer}
.mft-analytics-consent button[data-choice="dismiss"]{padding:.45rem .7rem}
.mft-analytics-consent button[data-choice="grant"]{background:#143d3a;color:#fff}
.mft-analytics-consent :focus-visible{outline:2px solid #143d3a;outline-offset:3px}
.menu-open #mft-analytics-consent{display:none}
`);
}
fs.mkdirSync(path.join(dist,'reports'),{recursive:true});
report.controllerPages=[...report.injected];
report.opsHandoffPages=handoffEnabled()?[...report.injected]:[];
fs.writeFileSync(path.join(dist,'reports','analytics-integration.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ga4BasicMeasurementEnabled:report.enabled,googlePolicyStatus:policy.status,googleApprovedRoutes:report.allowedRoutes.length,firstPartyControllerEnabled:report.controllerEnabled,firstPartyControllerPages:report.injected.length}));
