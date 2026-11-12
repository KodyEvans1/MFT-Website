'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const profile=require('../content/autumn-profile.json'),registry=require('../content/clinician-registry.json').clinicians;
const booking=require('../content/simplepractice-booking.json'),scope=require('../src/clinician-scope');
const dist=path.resolve(__dirname,'../dist'),read=s=>fs.readFileSync(path.join(dist,s,'index.html'),'utf8');
const plain=h=>h.replace(/<[^>]+>/g,'').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
test('Autumn biography preserves every supplied focus, approach, concern and education item',()=>{
 const h=read(profile.slug),text=plain(h);
 for(const s of profile.sections){assert.ok(text.includes(s.heading));for(const p of s.paragraphs)assert.ok(text.includes(p));}
 for(const s of [...profile.therapyFor,...profile.approaches]){assert.ok(text.includes(s.heading));assert.ok(text.includes(s.text));}
 for(const item of [...profile.focusAreas,...profile.education,...profile.training])assert.ok(text.includes(item),item);
 assert.match(text,/Children ages 6\+/);assert.match(text,/LMHCA/);assert.match(text,/not an emergency or on-call service/);
 assert.doesNotMatch(h,/<form\b|<input\b|<textarea\b/);
});
test('Autumn uses the supplied self-hosted photograph with explicit intrinsic dimensions',()=>{
 const h=read(profile.slug),image=h.match(/<img class="hero-media"[^>]+>/)[0];
 assert.ok(image.includes(profile.portrait.path));assert.match(image,/data-portrait-fit="contain"/);
 assert.match(image,/width="576" height="1023"/);
 const photo=fs.readFileSync(path.join(dist,profile.portrait.path));
 assert.equal(crypto.createHash('sha256').update(photo).digest('hex'),profile.portrait.sha256);
 assert.ok(photo.length<40000);
});
test('Autumn is visible in team, homepage and appropriate age-based services with age six minimum',()=>{
 for(const route of ['', 'team','childrentherapy','teen-counseling','new-page'])assert.ok(read(route).includes('/autumn-alexander/'),route);
 for(const route of ['childrentherapy','teen-counseling'])assert.match(read(route),/Children ages 6\+/);
 const person=registry.find(p=>p.slug===profile.slug);assert.equal(person.minimumAge,6);
 assert.ok(!person.populations.includes('couples'));assert.ok(!person.populations.includes('families'));
});
test('Autumn uses the owner-supplied calendar and retains secondary practice contact',()=>{
 const h=read(profile.slug),hero=h.match(/<section class="hero mft-clinician-hero"[\s\S]*?<\/section>/)[0];
 assert.match(hero,/clinicianId=2183370/);assert.ok(hero.includes(profile.booking.label));
 assert.equal(booking.clinicians.find(p=>p.slug===profile.slug).id,'2183370');
 assert.doesNotMatch(hero,/mailto:|https:\/\/ops\./);
 assert.ok(h.includes(profile.booking.contactUrl));assert.match(h,/A request is not a confirmed booking/);
});
test('Taylor adult-only scope is explicit and does not imply child or play-therapy services',()=>{
 const p=registry.find(p=>p.slug==='dr-nolan'),h=read(p.slug),main=h.match(/<main\b[^>]*>[\s\S]*?<\/main>/)[0];
 assert.ok(p.populations.includes('adults'));for(const age of ['children','teens'])assert.ok(!p.populations.includes(age));
 assert.deepEqual(p.excludedModalities,['play-therapy','child-centered-play-therapy']);
 assert.match(plain(main),/Taylor works with adult individuals, couples, and partners/);
 assert.doesNotMatch(main,/href="\/(?:play-therapy|child-centered-play-therapy|childrentherapy|teen-counseling)\//);
 assert.match(main,/clinicianId=2031820/);
});
test('Shared-topic scoring cannot override Taylor child and play exclusions',()=>{
 const p=registry.find(p=>p.slug==='dr-nolan');
 for(const [type,slug,name] of [['population','therapy-for-children-experiencing-divorce','Children and divorce'],['population','therapy-for-teens-with-anxiety','Teens with anxiety'],['modality','play-therapy','Play therapy']])assert.equal(scope.eligibleForTopic(p,type,{slug,name,tags:['anxiety']}),false);
 assert.equal(scope.eligibleForTopic(p,'concern',{slug:'anxiety-stress-therapy',name:'Anxiety',tags:[]}),true);
});
test('Neither Taylor nor Autumn is represented as a play therapist',()=>{
 for(const route of ['play-therapy','child-centered-play-therapy']){
  const h=read(route);assert.doesNotMatch(h,/href="\/(?:dr-nolan|autumn-alexander)\//);
 }
 for(const route of ['childrentherapy','teen-counseling','therapy-for-teens-with-anxiety','therapy-for-children-experiencing-divorce'])assert.doesNotMatch(read(route),/data-clinician="dr-nolan"|href="\/dr-nolan\//);
});
test('Profile publication does not manufacture article, teen-pathway or campaign approval',()=>{
 assert.equal(profile.reviewStatus,'owner-approved');assert.equal(profile.sourceNotes.approvedOn,'2026-11-11');
 const basic=require('../content/editorial-library.json');assert.ok(basic.articles.every(p=>p.status==='draft'));
 assert.equal(booking.clinicians.length,6);
});
