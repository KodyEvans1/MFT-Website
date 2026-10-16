'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const a=require('../src/analytics-build');

test('GA4 basic measurement is production-and-flag gated',()=>{
  assert.equal(a.enabled({CONTEXT:'production',SITE_INDEXING_ENABLED:'true',GA4_BASIC_MEASUREMENT_ENABLED:'true'}),true);
  for(const env of [
    {CONTEXT:'deploy-preview',SITE_INDEXING_ENABLED:'true',GA4_BASIC_MEASUREMENT_ENABLED:'true'},
    {CONTEXT:'production',SITE_INDEXING_ENABLED:'false',GA4_BASIC_MEASUREMENT_ENABLED:'true'},
    {CONTEXT:'production',SITE_INDEXING_ENABLED:'true',GA4_BASIC_MEASUREMENT_ENABLED:'false'},
    {CONTEXT:'production',SITE_INDEXING_ENABLED:'true'}
  ]) assert.equal(a.enabled(env),false);
});

test('only approved nonsensitive routes receive one local consent controller; no Google loads before consent',()=>{
  const env={CONTEXT:'production',SITE_INDEXING_ENABLED:'true',GA4_BASIC_MEASUREMENT_ENABLED:'true'};
  const allowed=new Set(['/','/services/','/marriage-reset-assessment/']);
  const html='<html><head></head><body><a href="https://marriagefamilytherapy.clientsecure.me/">Book</a></body></html>';
  const home=a.inject(html,'/',allowed,env);
  assert.equal(home.injected,true);
  assert.equal((home.html.match(/mft-ga4-bootstrap\.js/g)||[]).length,0);
  assert.equal((home.html.match(/mft-analytics\.js/g)||[]).length,1);
  assert.equal((home.html.match(/googletagmanager\.com\/gtag\/js\?id=G-BTK39BBNRE/g)||[]).length,0);
  assert.match(home.html,/data-mft-frame-version="[a-f0-9]{16}"/);
  assert.match(home.html,/G-BTK39BBNRE/);
  assert.equal(a.inject(html,'/not-approved/',allowed,env).injected,false);
  assert.equal(a.inject(html,'/marriage-reset-assessment/',allowed,env).injected,false);
});

test('page identifiers do not expose route text',()=>{
  const key=a.pageKey('/anxiety-stress-therapy/');
  assert.match(key,/^[a-f0-9]{16}$/);
  assert.equal(key.includes('anxiety'),false);
});

test('browser analytics asset does not read sensitive page or form values',()=>{
  const js=fs.readFileSync(path.join(__dirname,'../src/assets/mft-analytics.js'),'utf8');
  assert.doesNotMatch(js,/document\.title|location\.href|location\.search|FormData|querySelector\(['"][^'"]*(?:input|textarea|form)/);
  assert.doesNotMatch(js,/createElement\(['"]script['"]\)/);
  assert.match(js,/status\(\)!=='granted'/);
  assert.match(js,/globalPrivacyControl/);
  assert.match(js,/doNotTrack/);
  const isolated=fs.readFileSync(path.join(__dirname,'../src/assets/mft-ga4-frame.js'),'utf8');
  assert.match(isolated,/send_page_view:false/);
  assert.match(isolated,/allow_google_signals:false/);
  assert.match(isolated,/allow_ad_personalization_signals:false/);
  assert.match(isolated,/user_data:\{\}/);
  assert.match(isolated,/cookie_domain:'none'/);
  assert.doesNotMatch(isolated,/parent\.document|top\.document|parent\.location|FormData|querySelector/);

});

test('GA4 bootstrap defaults analytics and ad consent to denied before Google loads',()=>{
  const js=fs.readFileSync(path.join(__dirname,'../src/assets/mft-ga4-bootstrap.js'),'utf8');
  assert.match(js,/gtag\('consent','default'/);
  for(const key of ['analytics_storage','ad_storage','ad_user_data','ad_personalization'])
    assert.match(js,new RegExp(key+":'denied'"));
});

test('intake, coverage, appointment and form pages cannot receive analytics',()=>{
 const env={CONTEXT:'production',SITE_INDEXING_ENABLED:'true',GA4_BASIC_MEASUREMENT_ENABLED:'true'};
 for(const route of ['/check-my-coverage/','/intake/','/patient/','/appointment/','/marriagereset/','/marriage-reset-assessment/','/start/']){
  assert.equal(a.inject('<html><body></body></html>',route,new Set([route]),env).injected,false,route);
 }
 assert.equal(a.inject('<html><body><form></form></body></html>','/',new Set(['/']),env).injected,false);
});
test('activation is production-only in Netlify and measurement assets are versioned',()=>{
 const toml=fs.readFileSync(path.join(__dirname,'../netlify.toml'),'utf8');
 assert.match(toml,/\[context.production.environment\]\s+GA4_BASIC_MEASUREMENT_ENABLED = "true"/);
 for(const context of ['deploy-preview','branch-deploy'])assert.ok(toml.includes('[context.'+context+'.environment]\n  GA4_BASIC_MEASUREMENT_ENABLED = "false"'));
 assert.match(a.assetVersion('mft-analytics.js'),/^[a-f0-9]{16}$/);
});
