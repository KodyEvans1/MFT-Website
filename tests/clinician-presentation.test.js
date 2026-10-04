'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ui=require('../src/ui/clinician-presentation');
const people=require('../content/clinician-registry.json').clinicians;
const dist=path.resolve(__dirname,'../dist');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const files=walk(dist).filter(f=>f.endsWith('.html'));
const photoIds=['ed7383ec','83275db3','832941fe','b81f7500','adfbbf96','dcad02ca'];
test('One canonical name and separate license are used in all clinician identities',()=>{
 assert.equal(ui.person('kody-evans-bio').name,'Kody Evans');assert.equal(ui.person('kody-evans-bio').license,'LMFT');
 for(const p of people){const html=ui.identity(p.slug);assert.ok(html.includes('>'+p.name+'</h3>'));assert.ok(html.includes('class="mft-clinician-license">'));assert.ok(html.includes(p.license));}
 for(const f of files)assert.doesNotMatch(fs.readFileSync(f,'utf8'),/Kody Evans, LMFT/,'Legacy name on '+f);
});
test('All five biography heroes place credentials after the name and contain their own source portrait',()=>{
 for(const p of people){const h=fs.readFileSync(path.join(dist,p.slug,'index.html'),'utf8');assert.match(h,new RegExp('data-clinician-hero="'+p.slug+'"'));assert.ok(h.indexOf('class="mft-clinician-name"')<h.indexOf('class="mft-clinician-license"'));assert.ok(h.includes('data-portrait-variant="hero"'));assert.ok(h.includes('data-portrait-fit="contain"'));assert.ok(h.includes('data-hero-treatment="green-blend"'));assert.ok(h.includes('>'+p.name+'</h1>'));assert.doesNotMatch(h,/<div class="hero-shade">/);}
});
test('Every actual clinician and staff photo is wrapped by the shared portrait frame',()=>{
 let photos=0;
 for(const f of files){const h=fs.readFileSync(f,'utf8');for(const m of h.matchAll(/<img\b[^>]*>/g))if(photoIds.some(id=>m[0].includes(id))){photos++;assert.match(m[0],/data-portrait-fit="(?:cover|contain)"/);if(m[0].includes('class="hero-media"'))assert.match(m[0],/data-portrait-fit="contain"/);else assert.match(m[0],/data-portrait-fit="cover"/);assert.match(h.slice(0,m.index),/<div class="mft-portrait-frame[^>]*data-portrait-variant="(?:card|directory|hero|staff)">$/);}}
 assert.ok(photos>20);
});
test('Frame size is independent of photo dimensions and credential line count',()=>{
 const css=fs.readFileSync(path.resolve(__dirname,'../src/assets/portraits.css'),'utf8');assert.match(css,/position:absolute;inset:0;display:block;width:100%;height:100%/);assert.match(css,/--mft-portrait-card-width:88px;--mft-portrait-card-height:110px/);assert.match(css,/--mft-portrait-card-width:72px;--mft-portrait-card-height:90px/);assert.match(css,/align-items:start/);assert.match(css,/mft-portrait--hero>\.hero-media\{[^}]*object-fit:contain/);
});
test('Shared presentation rejects unknown people, invalid variants and unsafe sources',()=>{
 assert.throws(()=>ui.person('unknown'));assert.throws(()=>ui.identity(people[0].slug,'script'));assert.throws(()=>ui.portrait('javascript:alert(1)','x'));assert.throws(()=>ui.portrait('/photo.jpg','x','unknown'));
 const h=ui.portrait('/photo.jpg','<script>');assert.ok(h.includes('&lt;script&gt;'));assert.doesNotMatch(h,/<script>/);
});
test('Portrait correction never changes clinician booking identifiers or source photographs',()=>{
 const expected=['1701440','2031820','2027366','2154633','2065412'];const booking=require('../content/simplepractice-booking.json');assert.deepEqual(people.map(p=>booking.clinicians.find(c=>c.slug===p.slug).id),expected);
 for(const p of people)assert.match(fs.readFileSync(path.join(dist,p.slug,'index.html'),'utf8'),/class="hero-media" src="https:\/\/images.squarespace-cdn.com/);
});

test('Biography source renditions respect real pixel dimensions, including small originals',()=>{
 assert.deepEqual([ui.heroSources['emily-johnsrud-bio'].width,ui.heroSources['dr-nolan'].width],[512,561]);
 for(const p of people){const h=fs.readFileSync(path.join(dist,p.slug,'index.html'),'utf8'),cfg=ui.heroSources[p.slug];assert.ok(cfg.maxWidth<=cfg.width);const img=h.match(/<img class="hero-media"[^>]+>/)[0];assert.match(img,/srcset=/);assert.ok(img.includes(' '+cfg.width+'w'));assert.ok(img.includes('width="'+cfg.width+'"'));}
});
test('Restored hero keeps green blend and light copy rather than a framed cream portrait',()=>{
 const css=fs.readFileSync(path.resolve(__dirname,'../src/assets/portraits.css'),'utf8');const rules=css.slice(css.indexOf('/* Biography hero:'));
 assert.match(rules,/background:linear-gradient\(100deg,#092624/);assert.match(rules,/mask-composite:intersect/);assert.match(rules,/inset:32px/);assert.match(rules,/object-fit:contain/);assert.doesNotMatch(rules,/object-fit:cover|background:#f4f0e7|border-radius:24px/);
});
