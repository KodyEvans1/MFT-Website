'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dist=path.join(__dirname,'../dist');
const page=slug=>fs.readFileSync(slug?path.join(dist,slug,'index.html'):path.join(dist,'index.html'),'utf8');
const text=html=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ');

test('Kody shows approved training but not Capella education',()=>{
  const h=text(page('kody-evans-bio')); assert.match(h,/ADHD-CCSP/);assert.match(h,/Level 1 Gottman Training/);assert.doesNotMatch(h,/Capella/i);
});
for(const [slug,needle] of [['dr-nolan','Johns Hopkins University'],['emily-johnsrud-bio','Seattle University'],['gary-ashley','Colorado Christian University'],['new-page-47','University of Washington']])
  test(slug+' includes verified education and training',()=>{const h=text(page(slug));assert.match(h,new RegExp(needle));assert.match(h,/Training/);});
test('benefits page contains approved carriers, routing information and no sensitive public form',()=>{
  const h=page('check-my-coverage'),t=text(h); for(const carrier of ['Premera','Aetna','Regence','Cigna'])assert.match(t,new RegExp(carrier));
  assert.match(t,/Couples consultations and couples sessions are private pay/); assert.match(h,/mailto:support@mft.care\?subject=Benefits%20verification/);
  assert.match(h,/Best%20phone%20number/);assert.match(h,/Insurance%20company/);assert.match(h,/Service%20I%20am%20seeking/);
  assert.doesNotMatch(h,/<input[^>]+(?:member|diagnos|birth)/i);
});
test('contact page has current office hours and office identity',()=>{
  const t=text(page('therapy-contact-woodinville')); for(const v of ['Monday','9:00 AM','Tuesday & Wednesday','8:00 AM','Thursday & Friday','6:00 PM','Saturday','2:00 PM','19151 NE 144th Ave'])assert.ok(t.includes(v),v);
});
test('homepage feedback is anonymized and not represented as Google reviews',()=>{
  const t=text(page(''));assert.match(t,/paraphrased and anonymized/);assert.match(t,/Individual experiences vary/);assert.doesNotMatch(t,/Google review/i);
});
test('individual and couples consultation choices use the approved different starting paths',()=>{
  const individual=text(page('new-page')),couples=text(page('marriage-and-couples-therapy-counseling'));
  assert.match(individual,/26-minute private-pay/);assert.match(individual,/53-minute first clinical session/);assert.doesNotMatch(individual,/30-minute couples consultation/);
  assert.match(couples,/30-minute couples consultation/);assert.match(couples,/couples therapy/i);assert.match(couples,/Couples consultations and couples sessions are private pay/);assert.doesNotMatch(couples,/53-minute first clinical session/);
});
test('free consultation links are gated before direct SimplePractice scheduling',()=>{
  for(const slug of ['new-page','marriage-and-couples-therapy-counseling']){const h=page(slug);assert.match(text(h),/10-minute/);assert.match(h,/https:\/\/marriagefamilytherapy\.clientsecure\.me/);}
  const js=fs.readFileSync(path.join(dist,'assets/mft-booking.js'),'utf8');assert.match(js,/mftTenMinuteConsultation/);assert.match(js,/one time for new clients only/);assert.match(js,/not a therapy session/);assert.match(js,/disabled>Continue to scheduling/);
});
test('Ops never appears as a client booking or measurement destination',()=>{
  const bad=[];for(const f of fs.readdirSync(dist,{withFileTypes:true})){const file=f.isDirectory()?path.join(dist,f.name,'index.html'):f.name==='index.html'?path.join(dist,'index.html'):null;if(!file||!fs.existsSync(file))continue;const h=fs.readFileSync(file,'utf8');
    if(/https:\/\/ops\.mft\.care\/go\/(?:book|consult)/i.test(h)||/api\/marketing\/website-events/i.test(h))bad.push(path.relative(dist,file));
    for(const m of h.matchAll(/<a\b[^>]*href="https:\/\/ops\.mft\.care\/([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)){const label=text(m[2]);if(!/staff operations|marriage\.reset/i.test(label))bad.push(path.relative(dist,file)+': '+label);}
  }assert.deepEqual(bad,[]);
});
