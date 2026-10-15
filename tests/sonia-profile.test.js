'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),dist=path.join(root,'dist');
const read=s=>fs.readFileSync(path.join(dist,s,'index.html'),'utf8');
const profile=require('../content/sonia-profile.json'),people=require('../content/clinician-registry.json').clinicians;
const booking=require('../content/simplepractice-booking.json'),core=require('../src/booking-core');
const slug='sonia-hassan-bio',h=read(slug);
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const plain=s=>s.replace(/<[^>]+>/g,'').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
test('Sonia has authored biography and approach sections inside the shared profile layout',()=>{
 for(const section of profile.sections){assert.ok(h.includes('<h2>'+section.heading+'</h2>'));for(const p of section.paragraphs)assert.ok(plain(h).includes(p));}
 assert.match(h,/data-experience-body="sonia-hassan-bio"/);
 assert.match(h,/data-hero-treatment="green-blend"/);assert.match(h,/data-portrait-fit="contain"/);
 assert.match(h,/adfbbf96-f0ab-49ce-9f82-3c3a2906adc0/);assert.match(h,/LSWAIC/);assert.match(h,/University of Washington, 2024/);
 assert.doesNotMatch(profile.sections.map(s=>s.paragraphs.join(' ')).join(' '),/certified|LCSW|DBT certification|EMDR|Gottman/i);
});
test('Sonia registry, evidence, and displayed concerns and modalities agree',()=>{
 const p=people.find(p=>p.slug===slug),e=require('../content/clinician-evidence.json').clinicians.find(p=>p.slug===slug);
 assert.deepEqual(p.modalities,e.approaches);assert.equal(p.license,'LSWAIC');
 for(const v of ['teens','adults','older-adults','couples'])assert.ok(p.populations.includes(v));
 for(const v of ['depression','trauma','emotion-regulation','self-esteem','relationships'])assert.ok(p.concerns.includes(v));
 assert.match(h,/DBT\) skills/);assert.match(h,/Narrative Therapy/);assert.match(h,/somatic approaches/);
});
test('canonical, metadata and JSON-LD use one profile route with legacy 301 compatibility',()=>{
 const canonical='https://www.mft.care/'+slug;
 assert.ok(h.includes('<link rel="canonical" href="'+canonical+'">'));
 assert.ok(h.includes('property="og:url" content="'+canonical+'"'));
 const schemas=[...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
 assert.ok(JSON.stringify(schemas).includes(canonical+'#person'));
 assert.equal(fs.existsSync(path.join(dist,'new-page-47/index.html')),false);
 const redirects=fs.readFileSync(path.join(dist,'_redirects'),'utf8');
 assert.match(redirects,/^\/new-page-47 \/sonia-hassan-bio\/ 301$/m);
 assert.match(redirects,/^\/new-page-47\/ \/sonia-hassan-bio\/ 301$/m);
 assert.doesNotMatch(fs.readFileSync(path.join(dist,'sitemap.xml'),'utf8'),/new-page-47/);
 for(const f of walk(dist).filter(f=>f.endsWith('.html')))assert.doesNotMatch(fs.readFileSync(f,'utf8'),/href="(?:https:\/\/www\.mft\.care)?\/new-page-47(?:\/|["?#])/,'legacy link in '+f);
});
test('team, related care, and clinician recommendations target the canonical Sonia profile',()=>{
 assert.ok(read('team').includes('href="/sonia-hassan-bio/"'));
 for(const s of ['depression-therapy','grief-counseling','life-transitions-therapy','narrative-therapy','motivational-interviewing'])assert.ok(read(s).includes('href="/sonia-hassan-bio/"'),s);
 for(const s of ['new-page','teen-counseling','marriage-and-couples-therapy-counseling'])assert.ok(read(s).includes('href="/sonia-hassan-bio/"'),s);
});
test('canonical and legacy profile paths retain Sonia direct scheduling; general navigation stays practice-wide',()=>{
 const sonia=booking.clinicians.find(c=>c.key==='sonia');assert.equal(sonia.id,'2065412');
 for(const route of ['/sonia-hassan-bio','/sonia-hassan-bio/','/new-page-47','/new-page-47/?utm_source=test'])assert.equal(core.clinicianForPath(booking,route),sonia);
 const main=h.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)[1];let count=0;
 for(const m of main.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)){
  const href=m[1].match(/href="([^"]*)"/)?.[1]?.replace(/&amp;/g,'&');if(!href||!core.isAppointment(href,plain(m[2])))continue;
  count++;assert.equal(new URL(href).searchParams.get('clinicianId'),'2065412');assert.doesNotMatch(m[1],/target="_blank"/);assert.match(m[1],/data-mft-booking-mode="direct"/);
 }
 assert.ok(count>=1);
 const header=h.match(/<header\b[\s\S]*?<\/header>/)[0];assert.match(header,/href="https:\/\/marriagefamilytherapy\.clientsecure\.me\/request"/);
 assert.doesNotMatch(h,/data-spwidget-autobind|src="https:\/\/widget-cdn/);
});
test('other clinician biography prose is unchanged',()=>{
 const baseline=require('./fixtures/other-clinician-prose.json');
 for(const [s,expected] of Object.entries(baseline)){
  const prose=read(s).match(/<div class="experience-reading">([\s\S]*?)<\/div><aside/)[1];
  assert.equal(crypto.createHash('sha256').update(prose.replace(/<[^>]+>/g,'')).digest('hex'),expected,s);
 }
});
test('owner-supplied biography, philosophy, population sections and specialties are complete',()=>{
 assert.equal(profile.reviewStatus,'owner-approved');assert.equal(profile.sourceNotes.approvedOn,'2026-10-14');assert.equal(profile.sourceNotes.publicationBlocker,undefined);
 for(const heading of ['Care Philosophy','Working With Couples','Working With Teens','Working With Adults and Elder Adults'])assert.ok(profile.sections.some(s=>s.heading===heading));
 assert.equal(profile.sections.reduce((n,s)=>n+s.paragraphs.length,0),9);
 assert.deepEqual(profile.specialties,people.find(p=>p.slug===slug).specialties);
 for(const specialty of profile.specialties)assert.ok(plain(h).includes(specialty),specialty);
 assert.ok(plain(h).includes('I value open communication and welcome your feedback throughout the therapeutic process.'));
});
