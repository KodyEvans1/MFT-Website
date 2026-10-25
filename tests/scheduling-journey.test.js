'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=slug=>fs.readFileSync(path.join(root,'dist',slug,'index.html'),'utf8');
const {startMain,addJourneyLinks}=require('../src/start-page');
const text=h=>h.replace(/<[^>]+>/g,' ').replace(/&rsquo;|&#39;/g,"'").replace(/\s+/g,' ');
const guide=startMain();
test('Individual consultations are optional and the direct evaluation is named',()=>{
 const section=text(guide.match(/<section[^>]*id="individual-journey"[\s\S]*?<\/section>/)[0]);
 for(const phrase of ['Neither consultation is required','90791','free 10-minute','paid 30-minute individual consultation','measurable treatment plan','evidence-based'])assert.ok(section.includes(phrase),phrase);
});
test('Couples sequence is required consultation, separate partner evaluations, then joint sessions',()=>{
 const section=text(guide.match(/<section[^>]*id="couples-journey"[\s\S]*?<\/section>/)[0]);
 const a=section.indexOf('30-minute couples consultation'),b=section.indexOf('One diagnostic evaluation per partner'),c=section.indexOf('53-minute couples sessions');
 assert.ok(a>=0&&b>a&&c>b);
 for(const phrase of ['All couples begin','does not replace','one-time diagnostic evaluation','do not establish ongoing individual therapy','separate individual therapist','privacy, records','measurable treatment plan'])assert.ok(section.includes(phrase),phrase);
});
test('Phone introduction includes immediate fallback and private caller ID, without extending fallback to therapy',()=>{
 const section=text(guide.match(/<section[^>]*id="consultation-call"[\s\S]*?<\/section>/)[0]);
 for(const phrase of ['Available to all clients','not a diagnostic evaluation or a therapy session','does not work immediately','will be a phone call','Marriage.Family.Therapy','hidden, private, or unknown','applies to the 10-minute consultation'])assert.ok(section.includes(phrase),phrase);
});
test('Homepage and both service pages explain and link to the same journey',()=>{
 for(const slug of ['','new-page','marriage-and-couples-therapy-counseling']){
  const h=read(slug);assert.match(h,/href="\/how-to-start-therapy\/(?:#[a-z-]+)?"/);
  assert.doesNotMatch(text(h),/26[ -]minute|one time for new clients only|Three ways to begin couples/);
 }
 const couples=text(read('marriage-and-couples-therapy-counseling'));
 assert.match(couples,/All couples start with a paid 30-minute consultation/);
 assert.match(couples,/One diagnostic evaluation per partner/);
 assert.match(couples,/53-minute couples sessions/);
});
test('Guide links appear in shared header and footer without duplication',()=>{
 for(const slug of ['','how-to-start-therapy','new-page','marriage-and-couples-therapy-counseling','team','gary-ashley','online-therapy-washington']){
  const h=read(slug);for(const tag of ['header','footer']){const part=h.match(new RegExp('<'+tag+'\\b[^>]*>[\\s\\S]*?<\\/'+tag+'>'))[0];assert.equal((part.match(/href="\/how-to-start-therapy\/"/g)||[]).length,1,slug+':'+tag);}
  assert.equal(addJourneyLinks(h),h);
 }
});
test('No rendered public or draft page retains obsolete consultation policy',()=>{
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
 const failures=walk(path.join(root,'dist')).filter(p=>p.endsWith('.html')).filter(p=>/26[ -]minute|one time for new clients only|Three ways to begin couples/.test(text(fs.readFileSync(p,'utf8'))));
 assert.deepEqual(failures,[]);
});
test('Journey has usable fragments, no public intake, and native scheduling destinations',()=>{
 const h=read('how-to-start-therapy');const m=h.match(/<main\b[^>]*>[\s\S]*?<\/main>/)[0];
 assert.doesNotMatch(m,/<(?:form|input|textarea)\b|https:\/\/ops\.mft\.care/);
 const ids=[...h.matchAll(/(?:^|\s)id="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
 for(const match of h.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(match[1]),match[1]);
 for(const a of m.matchAll(/<a\b[^>]*data-mft-booking="true"[^>]*>/g))assert.match(a[0],/href="https:\/\/marriagefamilytherapy\.clientsecure\.me\/request"/);
 assert.match(h,/data-scheduling-journey="20261025"/);
});
