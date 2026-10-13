'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {sourceVersion,apply}=require('../scripts/prepare-stylesheet-version');
const root=path.resolve(__dirname,'..');
function fixture(fn){const r=fs.mkdtempSync(path.join(os.tmpdir(),'mft-style-version-'));try{for(const d of ['src','scripts','dist'])fs.mkdirSync(path.join(r,d));fs.writeFileSync(path.join(r,'src/styles.css'),'body{color:green}');fs.writeFileSync(path.join(r,'scripts/build.js'),'// style generator');return fn(r);}finally{fs.rmSync(r,{recursive:true,force:true});}}
test('Stylesheet address changes when a CSS source or style generator changes',()=>fixture(r=>{
 const a=sourceVersion(r);assert.equal(sourceVersion(r),a);fs.appendFileSync(path.join(r,'src/styles.css'),'/*changed*/');const b=sourceVersion(r);assert.notEqual(b,a);fs.appendFileSync(path.join(r,'scripts/build.js'),'//changed');assert.notEqual(sourceVersion(r),b);
}));
test('Only the shared stylesheet URL changes; versioning is idempotent',()=>fixture(r=>{
 const h='<html><head><link rel="stylesheet" href="/assets/styles.css"></head><body><h1>Preserve me</h1><a href="/team/">Team</a></body></html>',f=path.join(r,'dist/index.html');fs.writeFileSync(f,h);const report=apply(r),after=fs.readFileSync(f,'utf8');assert.equal(after.replace(report.href,'/assets/styles.css'),h);apply(r);assert.equal(fs.readFileSync(f,'utf8'),after);
}));
test('Missing stylesheet links fail instead of silently retaining an old layout',()=>fixture(r=>{fs.writeFileSync(path.join(r,'dist/index.html'),'<h1>No stylesheet</h1>');assert.throws(()=>apply(r),/Expected one/);}));
test('Every completed page uses the current version, including drafts and the error page',()=>{
 const version=sourceVersion(root);const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);const html=walk(path.join(root,'dist')).filter(f=>f.endsWith('.html'));assert.ok(html.length>800);for(const f of html){const h=fs.readFileSync(f,'utf8');assert.ok(h.includes('href="/assets/styles.css?v='+version+'"'),f);assert.doesNotMatch(h,/href="\/assets\/styles\.css"/);}
});
test('Stylesheet versioning precedes protected-core snapshots and expansion clones',()=>{
 const s=fs.readFileSync(path.join(root,'scripts/build-site.js'),'utf8');assert.ok(s.indexOf("'scripts/prepare-booking.js'")<s.indexOf("'src/seo-expansion.js'"));assert.ok(fs.readFileSync(path.join(root,'scripts/prepare-booking.js'),'utf8').includes("require('./prepare-stylesheet-version').apply(root)"));
});
