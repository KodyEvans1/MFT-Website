'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const pilot=require('../src/tricities-pilot');
const read=s=>fs.readFileSync(path.join(__dirname,'../dist',s,'index.html'),'utf8');
const h=read('online-therapy-tri-cities-wa');
const plain=h=>h.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
test('Tri-Cities adult pilot has one main action, adult focus, no fictitious local office',()=>{
 assert.equal((h.match(/<h1\b/g)||[]).length,1);
 for(const phrase of ['Online Therapy for Adults in the Tri-Cities','Kennewick','Pasco','Richland','West Richland','Our physical office is in Woodinville','no travel there is required for telehealth'])assert.ok(h.includes(phrase));
 assert.match(h,/data-pilot-appointment="true"[^>]*href="https:\/\/marriagefamilytherapy.clientsecure.me\/request"/);
 assert.match(h,/href="#optional-consultations"/);
 assert.doesNotMatch(h,/<aside class="mft-schedule-shortcuts"/);
});
test('Individual consultations are optional and only the 10-minute appointment is offered free',()=>{
 for(const phrase of ['No consultation is required','diagnostic evaluation (90791)','10-minute phone consultation','30-minute individual consultation','This is a paid appointment','Any applicable consultation fee will be explained before scheduling'])assert.ok(plain(h).includes(phrase));
 assert.doesNotMatch(plain(h),/email before scheduling|Once you have the code|consultation fee automatically|free virtual free virtual|Start online without paying/);
});
test('New appointments and existing client portal remain separate native links',()=>{
 assert.match(h,/data-mft-existing-client="true"[^>]*href="https:\/\/marriagefamilytherapy.clientsecure.me\/sign-in"/);
 for(const m of h.matchAll(/<a[^>]*data-mft-existing-client="true"[^>]*>/g))assert.doesNotMatch(m[0],/data-mft-booking=|data-spwidget-|target=/);
 assert.match(h,/id="pilot-scheduling-help"/);
 assert.ok(h.includes('the initial diagnostic evaluation, and the Telehealth location'));
 assert.doesNotMatch(h,/serviceId=|locationId=|modality=|telehealth=true/);
});
test('Unverified openings, clinician roster and per-plan participation are not invented',()=>{
 const m=h.match(/<main\b[^>]*>[\s\S]*?<\/main>/)[0];
 assert.doesNotMatch(m,/appointments available this week|accepts all|Premera|Aetna|Regence|Cigna|Meritain|data-pilot-clinician/);
 assert.ok(plain(m).includes('Verification is not a guarantee of coverage or payment'));
 assert.ok(plain(m).includes('availability and appointment types vary by clinician'));
 assert.doesNotMatch(m,/<(?:form|input|textarea)\b/);
});
test('Pilot preserves other services lower down and the required private-pay couples path',()=>{
 assert.match(h,/class="mft-footer-scheduling"/);assert.match(h,/data-mft-couples-consultation/);
 assert.ok(plain(h).includes('Couples consultations and couples therapy are private pay'));
 assert.ok(h.includes('one separate evaluation per partner'));
});
test('Pilot metadata and structured data agree without changing established canonical',()=>{
 assert.ok(h.includes('<title>'+pilot.TITLE+'</title>'));
 const schema=JSON.parse(h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
 assert.equal(schema['@graph'].find(n=>n['@type']==='WebPage').name,pilot.TITLE);
 assert.match(h,/rel="canonical" href="https:\/\/www.mft.care\/online-therapy-tri-cities-wa"/);
 assert.match(h,/tricities-pilot.css\?v=[a-f0-9]{16}/);
});
test('Pilot is idempotent and cannot change other routes',()=>{
 assert.equal(pilot.apply(h,pilot.ROUTE),h);
 for(const slug of ['','team','how-to-start-therapy','online-therapy-washington','sonia-hassan-bio','marriagereset']){
 const other=read(slug);assert.equal(pilot.apply(other,'/'+slug+'/'),other);assert.doesNotMatch(other,/data-tricities-pilot|tricities-pilot.css/);
 }
 assert.throws(()=>pilot.apply('<body>missing</body>',pilot.ROUTE),/main region missing/);
});
test('No new tag, identifier forwarding or inferred acquisition outcomes are introduced',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/tricities-pilot.js'),'utf8');
 assert.doesNotMatch(source,/gtag\(|fetch\(|localStorage|gclid|gbraid|wbraid|booking_completed/);
 const ids=[...h.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
});
