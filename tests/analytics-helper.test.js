'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const a=require('../src/analytics-build');
test('HTTPS helper is noindex, contains no care fields, and requires parent readiness before sending',()=>{
 const helper=fs.readFileSync(path.join(__dirname,'../dist/assets/mft-ga4-frame.html'),'utf8');
 assert.match(helper,/name="robots" content="noindex,nofollow"/);
 assert.doesNotMatch(helper,/<(?:form|input|textarea)\b|googletagmanager\.com|primary-nav|styles\.css/);
 assert.match(helper,/mft-ga4-frame\.js\?v=[a-f0-9]{16}/);
 const controller=fs.readFileSync(path.join(__dirname,'../src/assets/mft-analytics.js'),'utf8');
 assert.doesNotMatch(controller,/srcdoc/);assert.match(controller,/mft:analytics:ready/);
 const frame=fs.readFileSync(path.join(__dirname,'../src/assets/mft-ga4-frame.js'),'utf8');
 assert.match(frame,/window\.parent===window/);assert.match(frame,/event\.source!==window\.parent/);
 assert.match(a.frameVersion(),/^[a-f0-9]{16}$/);
});
