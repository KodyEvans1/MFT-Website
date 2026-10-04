'use strict';
const fs = require('node:fs'), path = require('node:path');
const {decorateHtml, config} = require('../src/booking-build');
const {indexingEnabled} = require('../src/seo-safety');
const root = path.resolve(__dirname,'..'), dist = path.join(root,'dist');
function walk(d) { return fs.readdirSync(d,{withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(path.join(d,e.name)) : [path.join(d,e.name)]); }
const measurementEnabled = process.env.SITE_MEASUREMENT_ENABLED === 'true' && process.env.CONTEXT === 'production' && indexingEnabled();
for (const [from,to] of [['src/booking-core.js','assets/mft-booking-core.js'],['src/assets/mft-booking.js','assets/mft-booking.js']]) fs.copyFileSync(path.join(root,from), path.join(dist,to));
fs.writeFileSync(path.join(dist,'assets/mft-booking-config.js'), 'window.MFT_BOOKING_CONFIG=' + JSON.stringify({...config,measurementEnabled}).replace(/</g,'\\u003c') + ';\n');
// Remove the superseded one-page query-string forwarding. There is one tracking owner.
const script = path.join(dist,'assets/site.js');
let js = fs.readFileSync(script,'utf8');
const legacy = /;\(\(\)=>\{const q=new URLSearchParams\(location\.search\);const gclid=q\.get\('gclid'\);[\s\S]*?a\.href=u\.toString\(\)\}\)\}\)\(\);/g;
const matches = js.match(legacy) || [];
if (matches.length !== 1) throw new Error('Expected exactly one legacy attribution script; inspect before changing');
fs.writeFileSync(script,js.replace(legacy,''));
const report = {version:1, measurementEnabled, pages:[], clinicians:config.clinicians.map(c=>({key:c.key,id:c.id,slug:c.slug}))};
for (const file of walk(dist).filter(f=>f.endsWith('.html'))) {
  const relative = path.relative(dist,file).split(path.sep).join('/');
  if (relative === '404.html') continue;
  const route = '/' + relative.replace(/index\.html$/,'');
  const cleanHero = require('../src/hero-media').apply(fs.readFileSync(file,'utf8'),route.replace(/^\/+|\/+$/g,''));
  const r = decorateHtml(cleanHero,route);
  fs.writeFileSync(file,r.html);
  report.pages.push({route,buttons:r.buttons,widget:r.widget});
}
let headers = fs.readFileSync(path.join(dist,'_headers'),'utf8');
headers = headers.replace(/Referrer-Policy: [^\n]+/g,'Referrer-Policy: no-referrer')
  .replace("script-src 'self';", "script-src 'self' https://widget-cdn.simplepractice.com;")
  .replace("frame-src 'none';", "frame-src https://clientsecure.me https://marriagefamilytherapy.clientsecure.me;")
  .replace("connect-src 'self';", "connect-src 'self' https://ops.mft.care https://clientsecure.me https://marriagefamilytherapy.clientsecure.me;");
fs.writeFileSync(path.join(dist,'_headers'),headers);
fs.appendFileSync(path.join(dist,'assets/styles.css'), '\n.mft-measurement-panel{position:fixed;z-index:10000;bottom:1rem;left:1rem;right:1rem;max-width:48rem;max-height:80vh;overflow:auto;margin:auto;padding:1.25rem;background:var(--cream,#f7f3ea);color:var(--ink,#143d3a);border:2px solid var(--gold,#b29b66);border-radius:1rem;box-shadow:0 4px 32px #0003}.mft-measurement-panel[hidden]{display:none}.mft-measurement-panel h2{font-size:1.4rem;margin:0 0 .5rem}.mft-measurement-panel p{font-size:.95rem;line-height:1.5}.mft-measurement-panel button,.mft-measurement-settings{font:inherit;padding:.6rem 1rem;cursor:pointer}.mft-measurement-panel button{margin:.35rem;border:1px solid currentColor;background:transparent;color:inherit;border-radius:.4rem}.mft-measurement-panel button:focus-visible,.mft-measurement-settings:focus-visible{outline:3px solid var(--gold,#b29b66);outline-offset:3px}.mft-measurement-settings{display:block;margin:1rem auto;background:transparent;color:inherit;border:1px solid currentColor}\n');
fs.mkdirSync(path.join(dist,'reports'),{recursive:true});
fs.writeFileSync(path.join(dist,'reports/booking-integration.json'), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({bookingCorePages:report.pages.length, measurementEnabled, clinicianMappings:config.clinicians.length}));
