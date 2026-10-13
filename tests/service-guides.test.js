'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const refs=require('../src/reference-pages'),guides=require('../src/service-guides'),ui=require('../src/ui/home-components');
const read=slug=>fs.readFileSync(path.resolve(__dirname,'../dist',slug,'index.html'),'utf8');
for(const p of guides.pages)test('Service: '+p.slug+' uses authored content in shared components',()=>{
 assert.equal(refs.validate(p),p);const h=read(p.slug);assert.match(h,/data-design-system="homepage-shared-v1"/);assert.match(h,/data-service-revision=/);
 for(const kind of ['hero','panel','disclosures','comparison','steps','faq','cards','example'])assert.ok(h.includes('data-ui="'+kind+'"'),p.slug+':'+kind);
 for(const s of p.sections)assert.ok(h.includes('id="'+s.id+'"'));
 assert.doesNotMatch(h,/<nav[^>]*class="breadcrumbs|data-experience-body=|class="hero-media"/);
 assert.equal(p.ownerApproval,false);assert.equal(p.clinicalApproval,false);assert.equal(p.visualApproval,false);
});
test('Service directory reaches all eight real care destinations',()=>{const entries=require('../src/service-directory').destinations,h=read('services');assert.equal(entries.length,8);for(const [slug] of entries){assert.match(read(slug),/<h1>/);assert.ok(h.includes('href="/'+slug+'/"'));}assert.match(h,/data-ui="cards"/);});
test('Retreat: exact provisional figures, no reservation or clinical-data form',()=>{const h=read('new-page-2');for(const price of ['$1,250','$2,400','$3,900'])assert.ok(h.includes(price));assert.match(h,/Provisional introductory pricing/);assert.match(h,/data-retreat-inquiry/);assert.match(h,/mailto:support@mft.care/);assert.doesNotMatch(h,/<(?:form|input|textarea)\b|"@type":"(?:Offer|Event)"|data-clinician=/);});
test('Retreat: progressive inquiry enhancement never sends or stores data',()=>{const js=fs.readFileSync(path.resolve(__dirname,'../src/assets/retreat-inquiry.js'),'utf8');assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie/);assert.match(js,/encodeURIComponent/);assert.match(require('../src/ui/service-components').inquiry({id:'x',title:'Ask',intro:'Intro',note:'No sending'}),/<noscript>/);});
test('Clinician connections match the service population, not an adult default',()=>{for(const p of guides.pages.filter(x=>x.slug!=='new-page-2')){const h=read(p.slug),people=refs.selectedClinicians(p.clinicianRule);assert.ok(people.length);for(const person of people){assert.ok(person.populations.includes(p.clinicianRule.population));assert.ok(h.includes('data-clinician="'+person.slug+'"'));}assert.doesNotMatch(h,/This clinician describes working with adults\./);}});
test('Service report checks built content and real destinations',()=>{assert.deepEqual(require('../src/service-check').inspect(path.resolve(__dirname,'../dist')).errors,[]);});
test('Rich service pages remain excluded from production, independent of indexing flag',()=>{assert.equal(refs.enabled({CONTEXT:'production',SITE_INDEXING_ENABLED:'false'}),false);assert.equal(refs.enabled({CONTEXT:'production',SITE_INDEXING_ENABLED:'true'}),false);});
