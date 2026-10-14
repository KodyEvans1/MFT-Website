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

test('only approved nonsensitive routes receive one local loader',()=>{
  const env={CONTEXT:'production',SITE_INDEXING_ENABLED:'true',GA4_BASIC_MEASUREMENT_ENABLED:'true'};
  const allowed=new Set(['/','/services/','/marriage-reset-assessment/']);
  const html='<html><head></head><body><a href="https://marriagefamilytherapy.clientsecure.me/">Book</a></body></html>';
  const home=a.inject(html,'/',allowed,env);
  assert.equal(home.injected,true);
  assert.equal((home.html.match(/mft-analytics\.js/g)||[]).length,1);
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
  assert.match(js,/send_page_view:false/);
  assert.match(js,/allow_google_signals:false/);
  assert.match(js,/allow_ad_personalization_signals:false/);
  assert.match(js,/page_referrer:safeReferrer\(\)/);
  assert.match(js,/status\(\)!=='granted'/);
});
