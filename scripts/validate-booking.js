'use strict';
const fs = require('node:fs'), path = require('node:path');
const core = require('../src/booking-core'), config = require('../content/simplepractice-booking.json');
const dist = path.resolve(__dirname,'../dist');
function walk(d) { return fs.readdirSync(d,{withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(path.join(d,e.name)) : [path.join(d,e.name)]); }
const errors = [], pages = [], codes = new Set();
for (const f of walk(dist).filter(f => f.endsWith('.html') && !f.endsWith('/404.html'))) {
  const route = '/' + path.relative(dist,f).split(path.sep).join('/').replace(/index\.html$/,'');
  const h = fs.readFileSync(f,'utf8'), code = core.pageCode(route);
  if (codes.has(code)) errors.push(`Duplicate measurement page code: ${route}`); codes.add(code);
  let n = 0;
  for (const m of h.matchAll(/<a\b([^>]*?)>([\s\S]*?)<\/a>/gi)) {
    const href = ((m[1].match(/href="([^"]*)"/) || [])[1] || '').replace(/&amp;/g,'&');
    const text = m[2].replace(/<[^>]*>/g,' ').trim();
    if (!core.isAppointment(href,text)) continue;
    n++;
    if (href.startsWith('https://ops.mft.care/')) errors.push(`Appointment still uses Ops redirect: ${route}`);
    const clinician = core.clinicianForPath(config,route);
    const inTag = tag => h.lastIndexOf('<'+tag,m.index) > h.lastIndexOf('</'+tag+'>',m.index);
    if (clinician && !inTag('header') && !inTag('footer') && href !== core.destination(config,clinician)) errors.push(`Wrong clinician fallback: ${route}`);
    if (/gclid=|gbraid=|wbraid=|utm_/i.test(href)) errors.push(`Attribution forwarded to scheduling: ${route}`);
  }
  const sensitive = /^\/marriage-reset-assessment(?:\/|$)/.test(route);
  for (const src of ['/assets/mft-booking-core.js','/assets/mft-booking-config.js','/assets/mft-booking.js',config.loaderUrl]) {
    const count = h.split('src="'+src+'"').length - 1;
    if (sensitive && count) errors.push(`Widget/measurement asset on assessment: ${route}`);
    else if (n && !sensitive && count !== 1) errors.push(`Expected one ${src} on ${route}, got ${count}`);
  }
  if (/Google Ads landing page [^<]*tracked scheduling pathway/.test(h)) errors.push(`Internal ad label visible: ${route}`);
  pages.push({code,route,appointmentButtons:n});
}
const js = fs.readFileSync(path.join(dist,'assets/site.js'),'utf8');
if (/const gclid=q\.get\('gclid'\)/.test(js)) errors.push('Legacy attribution script remains');
const headers = fs.readFileSync(path.join(dist,'_headers'),'utf8');
if (!headers.includes("script-src 'self' https://widget-cdn.simplepractice.com;") || !headers.includes('Referrer-Policy: no-referrer')) errors.push('Widget security headers missing');
const report = {version:1,htmlPages:pages.length,clinicianMappings:config.clinicians.length,errors,pages};
fs.mkdirSync(path.join(dist,'reports'),{recursive:true});
fs.writeFileSync(path.join(dist,'reports/booking-validation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({bookingValidatedPages:pages.length,errors}));
if(errors.length) process.exit(1);
