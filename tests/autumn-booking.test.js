'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const core=require('../src/booking-core'),{config,decorateHtml}=require('../src/booking-build');
const autumn=require('../src/autumn-booking');
const expected='https://clientsecure.me/widget-redirect?scopeId=4655482d-c076-4e4d-b683-d4a99135e67a&applicationId=7c72cb9f9a9b913654bb89d6c7b4e71a77911b30192051da35384b4d0c6d505b&channel=client_portal&appearance=%7B%22fullScreen%22%3Atrue%7D&clinicianId=2183370';
const read=slug=>fs.readFileSync(path.join(__dirname,'../dist',slug,'index.html'),'utf8');
const decode=s=>s.replace(/&amp;/g,'&');
test('Autumn calendar exactly preserves all owner-supplied URL parameters',()=>{
 assert.equal(autumn.calendar,expected);
 assert.equal(core.clinicianForPath(config,'/autumn-alexander/?utm_source=test').id,'2183370');
 assert.equal(new Set(config.clinicians.map(c=>c.id)).size,6);
 assert.equal(new URL(autumn.calendar).searchParams.has('serviceId'),false);
});
test('All five existing clinician mappings and practice-wide scheduling remain unchanged',()=>{
 const known={gary:'2154633',kody:'1701440',emily:'2027366',taylor:'2031820',sonia:'2065412'};
 for(const [key,id] of Object.entries(known)){
  const c=config.clinicians.find(c=>c.key===key);assert.equal(c.id,id);
  const u=new URL(core.destination(config,c));assert.equal(u.searchParams.get('channel'),'professional_website');
  assert.equal(u.searchParams.get('clinicianId'),id);
 }
 assert.equal(core.destination(config,null),'https://marriagefamilytherapy.clientsecure.me/request');
});
test('Explicit clinician cards retain their calendar in static HTML across unrelated routes and footers',()=>{
 for(const route of ['/','/team/','/teen-counseling/','/dr-nolan/']){
  const input='<html><body><header><a href="https://marriagefamilytherapy.clientsecure.me/request">Request appointment</a></header><main>'+autumn.button()+'</main><footer>'+autumn.button()+'</footer></body></html>';
  const h=decorateHtml(input,route).html;
  const tags=[...h.matchAll(/<a\b[^>]*data-mft-clinician="autumn"[^>]*>/g)];
  assert.equal(tags.length,2);
  for(const [tag] of tags)assert.equal(decode(tag.match(/href="([^"]+)"/)[1]),expected);
  assert.match(h,/<header><a[^>]*href="https:\/\/marriagefamilytherapy\.clientsecure\.me\/request"/);
  assert.equal(decorateHtml(h,route).html,h);
 }
});
test('Autumn has usable native calendar actions in profile, home, team and care cards',()=>{
 for(const slug of ['autumn-alexander','','team','childrentherapy','teen-counseling','new-page']){
  const h=read(slug),tags=[...h.matchAll(/<a\b[^>]*data-mft-clinician="autumn"[^>]*>/g)];
  assert.ok(tags.length>0,slug);
  for(const [tag] of tags){assert.equal(decode(tag.match(/href="([^"]+)"/)[1]),expected);assert.match(tag,/data-spwidget-clinician-id="2183370"/);assert.doesNotMatch(tag,/scope-global|target=|utm_|gclid/);}
  assert.doesNotMatch(h,/Ask about appointments with Autumn/);
 }
});
test('Returning-client portal and secondary support remain separate from Autumn requests',()=>{
 const h=read('autumn-alexander');
 assert.match(h,/href="mailto:support@mft.care\?subject=Appointments%20with%20Autumn"/);
 for(const [tag] of h.matchAll(/<a\b[^>]*data-mft-existing-client="true"[^>]*>/g)){
  assert.match(tag,/href="https:\/\/marriagefamilytherapy\.clientsecure\.me\/sign-in"/);
  assert.doesNotMatch(tag,/data-mft-booking=|clinicianId=|data-mft-ten-minute/);
 }
});
