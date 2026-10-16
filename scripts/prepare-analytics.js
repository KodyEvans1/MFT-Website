'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { SITE, enabled, normalizeRoute, inject, assetVersion } = require('../src/analytics-build');

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
const report={version:1,measurementId:'G-BTK39BBNRE',enabled:enabled(),approvalSource:'production sitemap only',allowedRoutes:[...allowedRoutes].sort(),injected:[],excluded:[]};
fs.copyFileSync(path.join(root,'src/assets/mft-ga4-bootstrap.js'),path.join(dist,'assets/mft-ga4-bootstrap.js'));
fs.copyFileSync(path.join(root,'src/assets/mft-ga4-frame.js'),path.join(dist,'assets/mft-ga4-frame.js'));
fs.copyFileSync(path.join(root,'src/assets/mft-analytics.js'),path.join(dist,'assets/mft-analytics.js'));
for(const file of files){
  const rel=path.relative(dist,file).split(path.sep).join('/');
  const route=rel==='index.html'?'/':'/'+rel.replace(/index\.html$/,'');
  const before=fs.readFileSync(file,'utf8');
  const result=inject(before,route,allowedRoutes);
  if(result.injected){fs.writeFileSync(file,result.html);report.injected.push(normalizeRoute(route));}
  else report.excluded.push({route:normalizeRoute(route),reason:result.reason});
}
if(enabled()){
  let headers=fs.readFileSync(path.join(dist,'_headers'),'utf8');
  headers=headers
    .replace('frame-src https://clientsecure.me', "frame-src 'self' https://clientsecure.me")
    .replace("script-src 'self' https://widget-cdn.simplepractice.com;", "script-src 'self' https://widget-cdn.simplepractice.com https://www.googletagmanager.com;")
    .replace("connect-src 'self' https://clientsecure.me https://marriagefamilytherapy.clientsecure.me;", "connect-src 'self' https://clientsecure.me https://marriagefamilytherapy.clientsecure.me https://www.google-analytics.com https://region1.google-analytics.com;")
    .replace("img-src 'self' https://images.squarespace-cdn.com data:;", "img-src 'self' https://images.squarespace-cdn.com https://www.google-analytics.com https://region1.google-analytics.com data:;");
  fs.writeFileSync(path.join(dist,'_headers'),headers);
  fs.appendFileSync(path.join(dist,'assets/styles.css'), '\n.mft-analytics-settings{font:inherit;font-size:.8rem;background:none;color:inherit;border:0;text-decoration:underline;text-underline-offset:.2em;cursor:pointer;padding:.5rem 0}\n');
  fs.appendFileSync(path.join(dist,'assets/styles.css'), '\n.mft-analytics-consent{position:fixed;z-index:9999;left:1rem;right:1rem;bottom:1rem;max-width:720px;margin:auto;padding:1rem 1.15rem;border:1px solid #b49554;border-radius:16px;background:#f7f3ea;color:#143d3a;box-shadow:0 16px 50px #0004;font:inherit}.mft-analytics-consent p{margin:0 0 .8rem}.mft-analytics-consent div{display:flex;gap:.65rem;justify-content:flex-end;flex-wrap:wrap}.mft-analytics-consent button{font:inherit;border-radius:999px;padding:.55rem 1rem;border:1px solid #143d3a;background:#fff;color:#143d3a;cursor:pointer}.mft-analytics-consent button[data-choice="grant"]{background:#143d3a;color:#fff}\n');
}
fs.mkdirSync(path.join(dist,'reports'),{recursive:true});
fs.writeFileSync(path.join(dist,'reports','analytics-integration.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ga4BasicMeasurementEnabled:report.enabled,approvedRoutes:report.allowedRoutes.length,injectedPages:report.injected.length}));
