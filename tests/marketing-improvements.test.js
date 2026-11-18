'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const marketing=require('../src/marketing-improvements');
const core=require('../src/booking-core'),config=require('../content/simplepractice-booking.json');
const root=path.resolve(__dirname,'..');
const read=slug=>fs.readFileSync(path.join(root,'dist',slug,'index.html'),'utf8');
const plain=h=>h.replace(/<[^>]*>/g,' ').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const routes=Object.keys(marketing.copy.routes);
function anchors(html,marker='data-marketing-appointment') {
 return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].filter(m=>m[1].includes(marker));
}
test('marketing candidate is restricted to five preserved routes and does not approve publication',()=>{
 assert.deepEqual(routes,['online-therapy-tri-cities-wa','gary-ashley','sonia-hassan-bio','new-page','marriage-and-couples-therapy-counseling']);
 assert.equal(marketing.approved(),false);
 for(const context of ['production'])assert.equal(marketing.enabled({CONTEXT:context,SITE_INDEXING_ENABLED:'false'}),false);
 assert.equal(marketing.enabled({SITE_INDEXING_ENABLED:'true'}),false);
 assert.equal(marketing.enabled({CONTEXT:'deploy-preview',SITE_INDEXING_ENABLED:'true'}),true);
 for(const slug of routes){const original=read(slug);assert.equal(marketing.apply(original,'/'+slug+'/',{CONTEXT:'production'}),original);}
 for(const slug of ['teen-counseling','autumn-alexander','dr-nolan','childrentherapy','team',''])assert.doesNotMatch(read(slug),/data-marketing-candidate=|marketing-improvements\.css/);
});
test('publication approval requires current revision and specific review evidence in every existing review category',()=>{
 const revision=marketing.revision(),record=structuredClone(marketing.review);
 record.contentRevision=revision;
 for(const key of ['clinical','operational','publication'])record.approvals[key]={status:'approved',reviewer:'Synthetic test reviewer',evidence:'Test-only approval fixture; never used for a build',reviewedRevision:revision};
 assert.equal(Boolean(marketing.approved(record)),true);
 for(const key of ['clinical','operational','publication']){
  const missing=structuredClone(record);missing.approvals[key].evidence=null;assert.equal(Boolean(marketing.approved(missing)),false,key);
  const stale=structuredClone(record);stale.approvals[key].reviewedRevision='older';assert.equal(Boolean(marketing.approved(stale)),false,key);
 }
 assert.equal(Boolean(marketing.approved(record,'changed-content')),false);
});
test('Tri-Cities begins with supplied adult-individual copy and keeps couples and returning access secondary',()=>{
 const h=read(routes[0]),p=marketing.copy.routes[routes[0]],main=h.match(/<main\b[\s\S]*?<\/main>/)[0];
 for(const text of [p.title,p.eyebrow,p.summary,p.note,p.location])assert.ok(plain(h).includes(text),text);
 const hero=main.match(/<section\b[\s\S]*?<\/section>/)[0];
 assert.match(hero,/Request an Online Individual Appointment/);
 assert.match(hero,/Explore an Optional Consultation/);
 assert.match(hero,/Check Insurance Benefits/);
 assert.doesNotMatch(hero,/couples consultation|email.*code|opening[s]? (?:today|now)/i);
 const order=['id="clinicians"','id="payment"','id="getting-started"','id="questions"','class="section marketing-repeat'];
 let last=-1;for(const marker of order){const at=main.indexOf(marker);assert.ok(at>last,marker);last=at;}
 assert.match(main,/we do not have a Tri-Cities branch office/);
 assert.match(main,/href="\/marriage-and-couples-therapy-counseling\/"/);
 assert.match(h,/data-mft-existing-client="true"[^>]*href="https:\/\/marriagefamilytherapy\.clientsecure\.me\/sign-in"/);
});
test('Tri-Cities practical FAQ and getting-started text use the supplied brief',()=>{
 const text=plain(read(routes[0]));
 for(const item of marketing.copy.questions)for(const value of Object.values(item))assert.ok(text.includes(value),value);
 for(const item of marketing.copy.gettingStarted)for(const value of Object.values(item))assert.ok(text.includes(value),value);
 assert.ok(text.includes('Free 10-minute phone consultation'));
 assert.ok(text.includes('Paid 30-minute individual consultation'));
 const paid=anchors(read(routes[0]),'data-mft-booking-intent').find(a=>plain(a[2])==='Request a Paid 30-minute Individual Consultation');
 assert.ok(paid);assert.match(paid[1],/data-mft-booking-intent="consultation"/);
});
test('Gary and Sonia preserve selected clinician for primary, repeated, header and footer native actions',()=>{
 for(const [slug,key,id] of [['gary-ashley','gary','2154633'],['sonia-hassan-bio','sonia','2065412']]){
  const h=read(slug),found=anchors(h);assert.equal(found.length,4,slug);
  assert.deepEqual(new Set(found.map(a=>a[1].match(/data-marketing-appointment="([^"]+)"/)[1])),new Set(['header','primary','repeated','footer']));
  for(const a of found){
   assert.match(a[1],new RegExp(`data-mft-clinician="${key}"`));
   const url=new URL(a[1].match(/href="([^"]+)"/)[1].replace(/&amp;/g,'&'));
   assert.equal(url.searchParams.get('clinicianId'),id);assert.equal(url.origin,'https://clientsecure.me');
   for(const field of ['serviceId','locationId','appointmentType','gclid','utm_campaign_id'])assert.equal(url.searchParams.has(field),false,field);
   assert.doesNotMatch(a[1],/target="_blank"/);
  }
  assert.match(h,/service, format, and time are not preselected/);
  assert.match(h,/data-portrait-fit="contain"/);
  assert.match(plain(h),/teens/);assert.match(plain(h),/couples/);
 }
});
test('Individual evaluation card enters the native request process despite qualified insurance prose',()=>{
 const h=read('new-page'),card=[...h.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].find(m=>m[2].includes('<b>Diagnostic evaluation (90791)</b>'));
 assert.ok(card);assert.match(card[1],/data-mft-booking-intent="appointment"/);
 assert.match(card[1],/href="https:\/\/marriagefamilytherapy\.clientsecure\.me\/request"/);
 assert.match(card[1],/data-mft-booking="true"/);
 assert.match(h,/Request an Individual Evaluation/);
 assert.match(h,/initial clinical evaluation directly, or choose an optional consultation/);
});
test('Couples entry preserves the complete sequence, private-pay and safety content',()=>{
 const h=read('marriage-and-couples-therapy-counseling'),text=plain(h);
 assert.match(h,/data-marketing-appointment="primary"[^>]*>[\s\S]*?Request a Couples Consultation/);
 for(const textPart of ['Couples consultations and couples therapy sessions are private pay.','30-minute couples consultation','One diagnostic evaluation per partner','53-minute couples sessions','When fear, threats, coercion, or abuse are present'])assert.ok(text.includes(textPart),textPart);
 assert.match(h,/href="https:\/\/www.thehotline.org\//);
 for(const slug of ['new-page','marriage-and-couples-therapy-counseling'])assert.match(read(slug),/This review version has not received clinical publication approval\./);
});
test('all reviewed appointment links are native, with visible missing-service guidance and valid help targets',()=>{
 for(const slug of routes){
  const h=read(slug);assert.match(h,/id="marketing-scheduling-help"/);
  assert.match(h,/Do not choose another service just to reserve a time|Do not select a 53-minute couples session/);
  for(const a of anchors(h)){
   assert.match(a[1],/href="https:\/\/(?:clientsecure.me\/widget-redirect|marriagefamilytherapy.clientsecure.me\/request)/);
   assert.match(a[1],/aria-describedby="marketing-scheduling-help"/);
   assert.doesNotMatch(a[1],/onclick=|javascript:|target=/);
  }
 }
});
test('candidate composition is idempotent and never spreads to generated or teen routes',()=>{
 for(const slug of routes)assert.equal(marketing.apply(read(slug),'/'+slug+'/'),read(slug));
 const fixture='<html><head></head><body><main>Unrelated content</main></body></html>';
 for(const route of ['/teen-counseling/','/online-therapy-pasco-wa/','/','/new-page-47/'])assert.equal(marketing.apply(fixture,route),fixture);
});
test('new marketing content never changes booking IDs, biography records, or event payloads',()=>{
 assert.equal(config.clinicians.find(c=>c.key==='gary').id,'2154633');
 assert.equal(config.clinicians.find(c=>c.key==='sonia').id,'2065412');
 const source=fs.readFileSync(path.join(root,'src/marketing-improvements.js'),'utf8');
 assert.doesNotMatch(source,/gtag\(|dataLayer|fetch\(|localStorage|sessionStorage|sendBeacon|<form|<input|<textarea/);
 assert.doesNotMatch(JSON.stringify(marketing.copy),/available (?:today|now)|guaranteed|certified|Tri-Cities office/);
 assert.equal(core.destination(config,config.clinicians.find(c=>c.key==='autumn')).includes('clinicianId=2183370'),true);
});
