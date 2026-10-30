'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const actions=require('../src/scheduling-actions'),core=require('../src/booking-core');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist');
const read=slug=>fs.readFileSync(path.join(dist,slug,'index.html'),'utf8');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const pages=()=>walk(dist).filter(f=>f.endsWith('.html')&&!f.endsWith('/assets/mft-ga4-frame.html'));
const plain=h=>h.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
test('Every care page has visible native existing-client and couples consultation shortcuts',()=>{
 for(const f of pages()){
  const h=fs.readFileSync(f,'utf8');
  assert.match(h,/data-scheduling-actions="20261029"/,f);
  assert.match(h,/data-mft-existing-client="true"[^>]*href="https:\/\/marriagefamilytherapy\.clientsecure\.me\/sign-in"/,f);
  assert.match(h,/data-mft-couples-consultation="true"/,f);
  assert.match(h,/class="mft-footer-scheduling"/,f);
 }
});
test('Existing-client links cannot be rewritten into new-client scheduling or consultation gates',()=>{
 assert.equal(core.isAppointment(actions.PORTAL,'Existing clients: schedule an appointment'),false);
 for(const f of pages())for(const m of fs.readFileSync(f,'utf8').matchAll(/<a\b[^>]*data-mft-existing-client="true"[^>]*>/g)){
  assert.match(m[0],/href="https:\/\/marriagefamilytherapy\.clientsecure\.me\/sign-in"/);
  assert.doesNotMatch(m[0],/data-mft-booking=|data-mft-ten-minute|data-spwidget-|target=/);
 }
});
test('Homepage opening includes all three distinct choices and an optional team link',()=>{
 const h=read('').match(/<section class="home-hero[\s\S]*?<\/section>/)[0];
 for(const phrase of ['Schedule a free 10-minute consultation','Schedule a 30-minute couples consultation','Existing clients: schedule an appointment','no 10-minute call required first','both partner evaluations','Meet the team'])assert.ok(h.includes(phrase),phrase);
 assert.equal((read('').match(/class="mft-schedule-shortcuts"/g)||[]).length,0,'Do not repeat homepage hero buttons in a second top bar');
});
test('Shared buttons and qualifiers are idempotent',()=>{
 for(const slug of ['','team','how-to-start-therapy','sonia-hassan-bio'])assert.equal(actions.apply(read(slug)),read(slug));
});
test('Couples readiness is explicit, works without JavaScript, and does not assert chart verification',()=>{
 const h=read('how-to-start-therapy'),text=plain(h);
 for(const phrase of ['Do not request a 53-minute couples session','all three preparation appointments','Existing individual clients follow this same couples pathway','initial 53-minute couples session','Consultation completed, but one or both partner evaluations still needed','not a check of your clinical record'])assert.ok(text.includes(phrase),phrase);
 assert.match(h,/<details class="mft-couples-readiness"><summary>We have completed the consultation and both partner evaluations<\/summary>/);
 assert.match(h,/id="existing-clients"/);assert.match(h,/id="returning-couples"/);
});
test('Added scheduling choices collect no answers or tracking and preserve the existing portal',()=>{
 const source=fs.readFileSync(path.join(root,'src/scheduling-actions.js'),'utf8');
 assert.doesNotMatch(source,/<(?:form|input|textarea|script)\b|localStorage|fetch\(|gtag\(|user_id/);
 assert.match(read(''),/href="https:\/\/marriagefamilytherapy\.clientsecure\.me\/?"[^>]*>Existing client portal/);
 const sensitive=read('marriage-reset-assessment');assert.doesNotMatch(sensitive,/data-mft-measurement-id=/);
});
