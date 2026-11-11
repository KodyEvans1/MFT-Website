'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const teen=require('../src/teen-appointments'),core=require('../src/booking-core');
const {config,decorateHtml}=require('../src/booking-build');
const source=require('../content/service-guides/teen-counseling.json');
const ui=require('../src/ui/home-components');
const read=slug=>fs.readFileSync(path.resolve(__dirname,'../dist',slug,'index.html'),'utf8');
const h=read('teen-counseling'),main=h.match(/<main\b[^>]*>[\s\S]*?<\/main>/)[0];
const anchor=attr=>h.match(new RegExp('<a\\b[^>]*'+attr+'[^>]*>[\\s\\S]*?<\\/a>'))?.[0]||'';
const href=a=>(a.match(/href="([^"]*)"/)||[])[1]?.replace(/&amp;/g,'&');
test('Teen hero leads with the requested service and native appointment action',()=>{
 assert.match(h,/data-teen-appointment-pathway="1"/);assert.match(h,/<h1>Teen counseling\. Space for your voice\.<\/h1>/);
 assert.match(anchor('data-teen-primary'),/Request a Teen Appointment/);assert.equal(href(anchor('data-teen-primary')),core.destination(config,null));
 assert.ok(h.indexOf('data-teen-primary')<h.indexOf('id="teen-appointments"'));
 assert.doesNotMatch(h,/data-mft-couples-consultation|class="mft-schedule-shortcuts"/);
});
test('Teen page separates appointment formats, evaluation, requests and confirmation',()=>{
 for(const s of ['In person in Woodinville','Telehealth in Washington','diagnostic evaluation (90791)','not a confirmed appointment until accepted','does not preselect a service'])assert.ok(h.includes(s),s);
 assert.doesNotMatch(main,/guaranteed|immediate openings|accepting new teen clients/i);
});
test('Consultations remain optional and differentiate free introduction from paid individual time',()=>{
 for(const s of ['Neither consultation is required','not therapy','Free 10-minute phone consultation','Paid 30-minute individual consultation'])assert.ok(h.includes(s),s);
 assert.equal(href(anchor('data-teen-ten-minute')),core.destination(config,null));
 assert.equal(href(anchor('data-teen-paid-consultation')),core.destination(config,null));
});
test('Three source-supported teen clinicians have correct native static booking fallbacks',()=>{
 const people=require('../content/clinician-registry.json').clinicians.filter(p=>p.status==='current'&&p.populations.includes('teens'));
 assert.equal(people.length,3);
 for(const p of people){const c=config.clinicians.find(c=>c.slug===p.slug),a=anchor('data-teen-clinician="'+c.key+'"');assert.equal(href(a),core.destination(config,c));assert.ok(a.includes('data-spwidget-clinician-id="'+c.id+'"'));assert.ok(h.includes(p.license));}
 assert.equal((h.match(/data-teen-clinician=/g)||[]).length,3);assert.match(h,/Teens; confirm exact ages\./);
});
test('Build honors approved explicit clinician mapping like the existing browser initializer',()=>{
 const c=config.clinicians.find(c=>c.key==='sonia');const result=decorateHtml('<html><body><main><a data-mft-clinician="sonia" href="'+config.generalUrl+'">Request with Sonia</a></main></body></html>','/teen-counseling/');
 assert.equal(href(result.html),core.destination(config,c));
 assert.throws(()=>decorateHtml('<a data-mft-clinician="unapproved" href="'+config.generalUrl+'">Request appointment</a>','/teen-counseling/'),/Unknown explicit booking clinician/);
});
test('Existing clients keep sign-in and do not enter the consultation gate',()=>{
 for(const a of h.matchAll(/<a\b[^>]*data-mft-existing-client="true"[^>]*>/g)){assert.equal(href(a[0]),new URL('/sign-in',config.generalUrl).href);assert.doesNotMatch(a[0],/data-mft-booking=|data-spwidget-|data-mft-ten-minute/);}
});
test('Clinical, caregiver, confidentiality and telehealth sections remain byte-for-byte unchanged',()=>{
 for(const id of ['understanding','participation','the-process','an-example','questions']){const section=source.sections.find(s=>s.id===id);assert.ok(h.includes(ui[section.type](section)),id);}
 assert.match(h,/This review version has not received clinical publication approval/);
});
test('Release approval cannot be inferred from general build or indexing flags',()=>{
 assert.equal(Boolean(teen.approved()),false);
 assert.equal(Boolean(teen.enabled({CONTEXT:'production',SITE_INDEXING_ENABLED:'true'})),false);
 assert.equal(Boolean(teen.enabled({CONTEXT:'deploy-preview',SITE_INDEXING_ENABLED:'true'})),true);
 assert.equal(teen.apply('unchanged','/teen-counseling/',{CONTEXT:'production'}),'unchanged');
});
test('Teen additions are idempotent and leave unrelated routes untouched',()=>{
 assert.equal(teen.apply(h,'/teen-counseling/'),h);
 for(const slug of ['new-page','gary-ashley','sonia-hassan-bio','online-therapy-tri-cities-wa','marriage-and-couples-therapy-counseling'])assert.equal(teen.apply('unchanged','/'+slug+'/'),'unchanged');
});
test('No new tracking, public intake, service parameter, or Ops request route',()=>{
 assert.doesNotMatch(main,/<(?:form|input|textarea)\b/);
 assert.doesNotMatch(fs.readFileSync(path.resolve(__dirname,'../src/teen-appointments.js'),'utf8'),/gtag\(|sendBeacon|localStorage|serviceId=|appointmentType=|ops\.mft\.care/);
 const cfg=fs.readFileSync(path.resolve(__dirname,'../dist/assets/mft-booking-config.js'),'utf8');assert.match(cfg,/"measurementEnabled":false/);
 for(const a of h.matchAll(/<a\b[^>]*data-mft-booking="true"[^>]*>/g))assert.doesNotMatch(href(a[0]),/utm_|gclid|gbraid|wbraid/);
});
test('Teen local fragments resolve and responsive CSS stays page-specific',()=>{
 for(const m of main.matchAll(/href="#([^"]+)"/g))assert.ok(h.includes('id="'+m[1]+'"'),m[1]);
 const css=h.match(/href="(\/assets\/teen-appointments-[a-f0-9]+\.css)"/)[1];assert.ok(fs.existsSync(path.resolve(__dirname,'../dist'+css)));
 assert.doesNotMatch(read('new-page'),/teen-appointments-[a-f0-9]+\.css/);
});
