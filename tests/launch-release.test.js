'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const refs=require('../src/reference-pages'),mr=require('../src/marriage-reset');
const PROD={CONTEXT:'production',SITE_INDEXING_ENABLED:'true'};
test('production-rich release is bounded to approved routes',()=>{
 for(const slug of ['services','new-page','marriage-and-couples-therapy-counseling','childrentherapy','teen-counseling','family-therapy-group-counseling','new-page-1','new-page-2']) assert.equal(refs.enabled(slug,PROD),true,slug);
 for(const slug of ['what-we-help-with','therapy-approaches','panic-attacks-therapy']) assert.equal(refs.enabled(slug,PROD),false,slug);
 assert.equal(mr.enabled('marriagereset',PROD),true);
 assert.equal(mr.enabled('marriage-reset-assessment',PROD),true);
});
