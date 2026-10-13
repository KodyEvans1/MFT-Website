'use strict';
const fs = require('node:fs'), path = require('node:path');
const {decorateHtml, config} = require('../src/booking-build');
const {indexingEnabled} = require('../src/seo-safety');
const root = path.resolve(__dirname,'..'), dist = path.join(root,'dist');
function walk(d) { return fs.readdirSync(d,{withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(path.join(d,e.name)) : [path.join(d,e.name)]); }
const measurementEnabled = false;
for (const [from,to] of [['src/booking-core.js','assets/mft-booking-core.js'],['src/assets/mft-booking.js','assets/mft-booking.js']]) fs.copyFileSync(path.join(root,from), path.join(dist,to));
fs.writeFileSync(path.join(dist,'assets/mft-booking-config.js'), 'window.MFT_BOOKING_CONFIG=' + JSON.stringify({...config,measurementEnabled}).replace(/</g,'\\u003c') + ';\n');
// Remove the superseded one-page query-string forwarding. There is one tracking owner.
const script = path.join(dist,'assets/site.js');
let js = fs.readFileSync(script,'utf8');
const legacy = /;\(\(\)=>\{const q=new URLSearchParams\(location\.search\);const gclid=q\.get\('gclid'\);[\s\S]*?a\.href=u\.toString\(\)\}\)\}\)\(\);/g;
const matches = js.match(legacy) || [];
if (matches.length > 1) throw new Error('Unexpected duplicate legacy attribution scripts; inspect before changing');
if (matches.length) fs.writeFileSync(script,js.replace(legacy,''));
const report = {version:1, measurementEnabled, pages:[], clinicians:config.clinicians.map(c=>({key:c.key,id:c.id,slug:c.slug}))};
for (const file of walk(dist).filter(f=>f.endsWith('.html'))) {
  const relative = path.relative(dist,file).split(path.sep).join('/');
  if (relative === '404.html') continue;
  const route = '/' + relative.replace(/index\.html$/,'');
  const mrPrepared = require('../src/marriage-reset').prepare(fs.readFileSync(file,'utf8'),route.replace(/^\/+|\/+$/g,''));
  const cleanHero = require('../src/hero-media').apply(mrPrepared,route.replace(/^\/+|\/+$/g,''));
  const r = decorateHtml(cleanHero,route);
  fs.writeFileSync(file,r.html);
  report.pages.push({route,buttons:r.buttons,widget:r.widget});
}
let headers = fs.readFileSync(path.join(dist,'_headers'),'utf8');
headers = headers.replace(/Referrer-Policy: [^\n]+/g,'Referrer-Policy: no-referrer')
  .replace("script-src 'self';", "script-src 'self' https://widget-cdn.simplepractice.com;")
  .replace("frame-src 'none';", "frame-src https://clientsecure.me https://marriagefamilytherapy.clientsecure.me;")
  .replace("connect-src 'self';", "connect-src 'self' https://clientsecure.me https://marriagefamilytherapy.clientsecure.me;");
fs.writeFileSync(path.join(dist,'_headers'),headers);
fs.appendFileSync(path.join(dist,'assets/styles.css'), `\n.mft-consultation-gate{max-width:640px;width:calc(100% - 2rem);border:2px solid var(--gold);border-radius:18px;padding:clamp(1.25rem,4vw,2rem);background:var(--cream,#f7f3ea);color:var(--ink,#143d3a);box-shadow:0 20px 70px #0005}.mft-consultation-gate::backdrop{background:rgba(7,31,30,.72)}.mft-dialog-close{float:right;border:0;background:transparent;font-size:2rem;cursor:pointer}.mft-consultation-check{display:grid;grid-template-columns:22px 1fr;gap:.75rem;align-items:start;margin:1.4rem 0}.mft-consultation-check input{width:18px;height:18px;margin-top:.2rem;accent-color:var(--ink)}.mft-consultation-gate button[disabled]{opacity:.45;cursor:not-allowed}\n`);
fs.mkdirSync(path.join(dist,'reports'),{recursive:true});
fs.writeFileSync(path.join(dist,'reports/booking-integration.json'), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({bookingCorePages:report.pages.length, measurementEnabled, clinicianMappings:config.clinicians.length}));

fs.appendFileSync(path.join(dist,'assets/styles.css'),fs.readFileSync(path.join(root,'src/assets/marriage-reset.css'),'utf8'));

// Assign a fresh CSS address before protected core pages are fingerprinted.
require('./prepare-stylesheet-version').apply(root);
