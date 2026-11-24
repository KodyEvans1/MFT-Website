/* Retired compatibility paths must fail closed even for a cached parent. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assets=path.join(__dirname,'../src/assets');
test('retired helper document remains noindex and contains no active Google integration',()=>{
 const helper=fs.readFileSync(path.join(assets,'mft-ga4-frame.html'),'utf8');
 assert.match(helper,/name="robots" content="noindex,nofollow"/);
 assert.doesNotMatch(helper,/<(?:form|input|textarea)\b|googletagmanager\.com|primary-nav|styles\.css/);
 assert.match(helper,/Google measurement is disabled/);
 const controller=fs.readFileSync(path.join(assets,'mft-analytics.js'),'utf8');
 assert.doesNotMatch(controller,/createElement\(['"](?:iframe|script)['"]\)|mft:analytics:(?:ready|init|intent)|window\.dataLayer|window\.gtag\(/);
});
test('direct or framed retired assets cannot configure, load or emit Google measurement',()=>{
 for(const asset of ['mft-ga4-bootstrap.js','mft-ga4-frame.js'])for(const framed of [false,true]){
  const calls=[],listeners={},created=[];
  const c={document:{createElement:tag=>{created.push(tag);return {};},head:{appendChild:x=>created.push(x)}},location:{origin:'https://www.mft.care'},gtag:(...args)=>calls.push(args),fetch:()=>{throw Error('No network permitted');},addEventListener:(name,fn)=>listeners[name]=fn};c.window=c;c.parent=framed?{postMessage:(...args)=>calls.push(args)}:c;
  const code=fs.readFileSync(path.join(assets,asset),'utf8');vm.runInNewContext(code,c);vm.runInNewContext(code,c);
  for(const type of ['mft:analytics:init','mft:analytics:intent','mft:analytics:ready'])listeners.message?.({source:c.parent,origin:c.location.origin,data:{type,pageKey:'0123456789abcdef',id:'m1',names:['simplepractice_exit'],placement:'body',sendPageView:true}});
  if(c.MFTAnalyticsReceiveIntent)c.MFTAnalyticsReceiveIntent({type:'mft:analytics:intent',id:'m1',names:['simplepractice_exit'],placement:'body'});
  assert.equal(c['ga-disable-G-BTK39BBNRE'],true);assert.equal(c.dataLayer,undefined);assert.equal(c.MFTAnalyticsReceiveIntent,undefined);
  assert.deepEqual(calls,[]);assert.deepEqual(created,[]);assert.deepEqual(Object.keys(listeners),[]);
 }
});
