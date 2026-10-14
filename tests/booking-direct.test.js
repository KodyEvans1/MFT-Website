'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const core=require('../src/booking-core');
const {config,decorateHtml,scriptSources}=require('../src/booking-build');
test('native appointment links have no embed autobinding or popup target',()=>{
  for(const c of [null,...config.clinicians]) assert.equal(core.attributes(config,c)['data-spwidget-autobind'],undefined);
  const h=decorateHtml('<head></head><main><a target="_blank" href="'+config.generalUrl+'">Free consultation</a></main><footer></footer>','/').html;
  assert.doesNotMatch(h,/target="_blank"|data-spwidget-autobind|integration-1\.0/);
  assert.match(h,/data-mft-booking-mode="direct"/);
  assert.match(h,/href="https:\/\/marriagefamilytherapy.clientsecure.me\/request"/);
  assert.equal(decorateHtml(h,'/').html,h);
});
test('outdated embedded loader is removed even from previously decorated HTML',()=>{
  const h=decorateHtml('<head></head><main><a href="'+config.generalUrl+'">Schedule</a></main><script src="'+config.loaderUrl+'" defer></script><footer></footer>','/').html;
  assert.doesNotMatch(h,/integration-1\.0\.js/);
  assert.equal(scriptSources.length,3);assert.ok(scriptSources.every(s=>s.startsWith('/assets/')));
});
test('consultation uses a real native anchor, no synthetic click or popup',()=>{
  const js=fs.readFileSync(path.join(__dirname,'../src/assets/mft-booking.js'),'utf8');
  assert.match(js,/<a role="link"[^>]*data-consultation-continue/);
  assert.match(js,/go\.href=destination/);assert.match(js,/go\.removeAttribute\('href'\)/);
  assert.doesNotMatch(js,/window\.open|a\.click\(|dispatchEvent|createElement\(['"]iframe/);
  assert.match(js,/formnovalidate/);assert.match(js,/HTMLDialogElement/);
});
test('every built appointment link stays usable without the embedded integration',()=>{
  const root=path.join(__dirname,'../dist');
  function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);}
  let links=0;
  for(const file of walk(root).filter(f=>f.endsWith('.html'))){
    const h=fs.readFileSync(file,'utf8');assert.doesNotMatch(h,/data-spwidget-autobind|src="https:\/\/widget-cdn.simplepractice.com\/assets\/integration-1.0.js/);
    for(const a of h.matchAll(/<a\b[^>]*data-mft-booking="true"[^>]*>/g)){
      links++;assert.match(a[0],/data-mft-booking-mode="direct"/);assert.match(a[0],/href="https:\/\/(?:clientsecure.me\/widget-redirect\?|marriagefamilytherapy.clientsecure.me\/request")/);
      assert.doesNotMatch(a[0],/target="_blank"/);
    }
  }
  assert.ok(links>100);
});
