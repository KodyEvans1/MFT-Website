'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {decorateHtml,config,scriptSources} = require('../src/booking-build');
const core = require('../src/booking-core');
const localSources=['/assets/mft-booking-core.js','/assets/mft-booking-config.js','/assets/mft-booking.js'];
const page='<html><head></head><body><header><a href="https://marriagefamilytherapy.clientsecure.me/">Free consultation</a></header><main><a href="https://marriagefamilytherapy.clientsecure.me/">Schedule now</a><a href="https://marriagefamilytherapy.clientsecure.me/">Existing client portal</a></main><footer></footer></body></html>';

test('booking scripts share a content-derived cache version; external loader is unchanged',()=>{
  const expected=createHash('sha256')
    .update(fs.readFileSync(path.join(__dirname,'../src/booking-core.js')))
    .update(fs.readFileSync(path.join(__dirname,'../src/assets/mft-booking.js')))
    .update(JSON.stringify(config)).digest('hex').slice(0,16);
  assert.deepEqual(scriptSources,localSources.map(src=>src+'?v='+expected).concat(config.loaderUrl));
});

test('general buttons use the calendar before JavaScript and load fresh booking scripts once',()=>{
  const result=decorateHtml(page,'/');
  const expected=core.destination(config,null).replace(/&/g,'&amp;');
  assert.equal(result.buttons,2);
  assert.equal(result.html.split('href="'+expected+'"').length-1,2);
  for(const src of localSources) assert.equal(result.html.split('src="'+src+'"').length-1,0);
  for(const src of scriptSources) assert.equal(result.html.split('src="'+src+'"').length-1,1);
  assert.ok(result.html.includes('href="https://marriagefamilytherapy.clientsecure.me/">Existing client portal'));
  assert.equal(decorateHtml(result.html,'/').html,result.html);
});

test('assessment routes do not acquire versioned booking or third-party scripts',()=>{
  const result=decorateHtml(page,'/marriage-reset-assessment/');
  assert.equal(result.widget,false);
  for(const src of scriptSources) assert.ok(!result.html.includes('src="'+src+'"'));
});
