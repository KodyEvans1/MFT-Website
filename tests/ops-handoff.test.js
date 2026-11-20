'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../src/assets/mft-analytics.js'),'utf8');
const build=require('../src/analytics-build');
const ENDPOINT='https://ops.mft.care/api/marketing/attribution';
const CONSENT='mft.analytics.consent.v4',SOURCE='mft.analytics.source.v1';
const PAGE='0123456789abcdef';
const copy=x=>JSON.parse(JSON.stringify(x));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function storage(seed={}){const m=new Map(Object.entries(seed));return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),all:()=>Object.fromEntries(m)};}
function fixture({choice='granted',local={},session={},search='',endpoint=ENDPOINT,cryptoMode='uuid',responses=[202],throwFrame=false,gpc=false,dnt='0',clock={now:1800000000000}}={}){
 const listeners={},elements=[],timers=[],posts=[],attempts=[];
 let queries=0,ids=0;
 const document={currentScript:{dataset:{mftMeasurementId:'G-BTK39BBNRE',mftPageKey:PAGE,mftFrameVersion:'abcdef0123456789',...(endpoint?{mftHandoffEndpoint:endpoint}:{})}},readyState:'loading',visibilityState:'visible',referrer:'',cookie:'',
  getElementById:()=>null,querySelector:()=>null,addEventListener:(key,fn)=>listeners['document:'+key]=fn,
  createElement:tag=>{if(tag==='iframe'&&throwFrame)throw Error('Blocked helper creation');const e={tag,style:{},setAttribute(){},addEventListener(){},remove(){e.removed=true;},querySelector:()=>({focus(){},remove(){}}),contentWindow:{postMessage:data=>posts.push(copy(data))}};elements.push(e);return e;},body:{appendChild(){}}};
 const c={document,location:{origin:'https://www.mft.care',get search(){queries++;return search;}},navigator:{globalPrivacyControl:gpc,doNotTrack:dnt},
  localStorage:storage({...((choice===null)?{}:{[CONSENT]:choice}),...local}),sessionStorage:storage(session),URL,URLSearchParams,AbortController,Uint8Array,
  Date:class extends Date{constructor(...args){super(...(args.length?args:[clock.now]));}static now(){return clock.now;}},
  setTimeout:(fn,delay)=>{timers.push({fn,delay});return timers.length;},addEventListener:(key,fn)=>listeners[key]=fn,
  fetch:(url,options)=>{attempts.push({url,options,body:JSON.parse(options.body)});const result=responses[Math.min(attempts.length-1,responses.length-1)];if(result==='throw')throw Error('Fetch unavailable');if(result==='reject')return Promise.reject(Error('Network failure'));if(result==='pending')return new Promise(()=>{});return Promise.resolve({status:result});}};
 if(cryptoMode!=='missing')c.crypto={getRandomValues:bytes=>{ids++;bytes.fill(ids);return bytes;},...(cryptoMode==='uuid'?{randomUUID:()=>{ids++;return 'a0000000-0000-4000-8000-'+String(ids).padStart(12,'0');}}:{})};
 c.window=c;vm.runInNewContext(code,c);
 const ready=()=>{const f=elements.find(e=>e.tag==='iframe'&&!e.removed);listeners.message({origin:c.location.origin,source:f.contentWindow,data:{type:'mft:analytics:ready'}});return f;};
 const runRetry=()=>{const pending=timers.filter(t=>t.delay===250&&!t.ran);for(const t of pending){t.ran=true;t.fn();}return pending.length;};
 return {c,attempts,posts,timers,ready,runRetry,clock,queries:()=>queries,ids:()=>ids,setup:()=>listeners['document:DOMContentLoaded'](),listeners};
}
test('first-party build endpoint requires its own flag plus approved production analytics eligibility',()=>{
 const env={CONTEXT:'production',SITE_INDEXING_ENABLED:'true',GA4_BASIC_MEASUREMENT_ENABLED:'true',OPS_HANDOFF_COLLECTION_ENABLED:'true'};
 assert.equal(build.handoffEnabled(env),true);
 for(const override of [{OPS_HANDOFF_COLLECTION_ENABLED:'false'},{GA4_BASIC_MEASUREMENT_ENABLED:'false'},{SITE_INDEXING_ENABLED:'false'},{CONTEXT:'deploy-preview'}])assert.equal(build.handoffEnabled({...env,...override}),false);
 const html='<html><body></body></html>',routes=new Set(['/','/team/','/assessment/']);
 assert.match(build.inject(html,'/',routes,env).html,/data-mft-handoff-endpoint="https:\/\/ops\.mft\.care\/api\/marketing\/attribution"/);
 assert.doesNotMatch(build.inject(html,'/',routes,{...env,OPS_HANDOFF_COLLECTION_ENABLED:'false'}).html,/data-mft-handoff-endpoint/);
 for(const route of ['/draft/','/assessment/'])assert.equal(build.inject(html,route,routes,env).injected,false);
});
test('only the qualifying handoff creates a first-party event; diagnostic events are never added',async()=>{
 const x=fixture();
 for(const name of ['consultation_click','clinician_schedule_click','appointment_request_click'])x.c.MFTSchedulingMeasurement.track([name],'body');
 assert.equal(x.attempts.length,0);assert.equal(x.ids(),0);
 x.c.MFTSchedulingMeasurement.track(['simplepractice_exit','simplepractice_exit','appointment_request_click'],'dialog');
 await tick();assert.equal(x.attempts.length,1);assert.equal(x.ids(),1);
 assert.deepEqual(x.attempts[0].body,{schemaVersion:1,eventType:'simplepractice_exit',eventId:'a0000000-0000-4000-8000-000000000001',occurredAt:'2027-01-15T08:00:00.000Z',consentVersion:CONSENT,source:'direct',medium:'none',pageCode:PAGE,placement:'dialog'});
});
test('collector uses the fixed reviewed destination, no cookies/referrer, and nonblocking keepalive delivery',()=>{
 const x=fixture({responses:['pending']});
 assert.equal(x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'header'),true);
 const sent=x.attempts[0];assert.equal(sent.url,ENDPOINT);
 for(const [key,value]of Object.entries({method:'POST',mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',keepalive:true}))assert.equal(sent.options[key],value);
 assert.deepEqual(copy(sent.options.headers),{'Content-Type':'text/plain;charset=UTF-8'});
 assert.equal(sent.options.signal.aborted,false);
 for(const endpoint of [null,'https://attacker.example.invalid/api/marketing/attribution','https://ops.mft.care/api/marketing/attribution?token=private']){
  const y=fixture({endpoint});y.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body');assert.equal(y.attempts.length,0);
 }
});
test('unset/refused/GPC/DNT consent performs no first-party ID generation, query read or network attempt',()=>{
 for(const options of [{choice:null},{choice:'denied'},{gpc:true},{dnt:'1'}]){
  const x=fixture({...options,search:'?gclid=secret-click'});
  assert.equal(x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body'),false);
  assert.equal(x.attempts.length,0);assert.equal(x.ids(),0);assert.equal(x.queries(),0);
 }
});
test('fresh consent migration purges the old source without reading the current query',()=>{
 const x=fixture({choice:null,local:{'mft.analytics.consent.v3':'granted'},session:{[SOURCE]:JSON.stringify({source:'google',medium:'cpc',campaignId:'24530528782',expiresAt:1800001800000})}});
 x.setup();assert.equal(x.c.MFTAnalyticsConsent.status(),'unset');assert.deepEqual(x.c.sessionStorage.all(),{});assert.equal(x.queries(),0);
});
test('one immutable UUID/timestamp/source payload is reused for a single retry after network or transient server failure',async()=>{
 for(const failure of ['reject','throw',429,500,503]){
  const x=fixture({responses:[failure,202],search:'?utm_source=google&utm_medium=cpc&utm_campaign_id=24530528782'});
  x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'dialog');await tick();
  assert.equal(x.attempts.length,1);x.clock.now+=10000;assert.equal(x.runRetry(),1);await tick();
  assert.equal(x.attempts.length,2);assert.equal(x.ids(),1);
  assert.equal(x.attempts[0].options.body,x.attempts[1].options.body);
  assert.equal(x.attempts[1].body.campaignId,'24530528782');assert.equal(x.runRetry(),0);
 }
});
test('no retries for successful or permanent refusal responses, and at most one retry on continued failure',async()=>{
 for(const response of [200,202,204,400,401,403,404,409,422]){
  const x=fixture({responses:[response]});x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body');await tick();
  assert.equal(x.runRetry(),0);assert.equal(x.attempts.length,1);
 }
 const x=fixture({responses:[503]});x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body');await tick();
 assert.equal(x.runRetry(),1);await tick();assert.equal(x.runRetry(),0);assert.equal(x.attempts.length,2);
});
test('withdrawal aborts pending first-party delivery and invalidates a retry even after a later grant',async()=>{
 const x=fixture({responses:['reject',202]});x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body');await tick();
 x.c.MFTAnalyticsConsent.deny();x.c.MFTAnalyticsConsent.grant();x.runRetry();await tick();assert.equal(x.attempts.length,1);
 const pending=fixture({responses:['pending']});pending.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body');
 pending.c.MFTAnalyticsConsent.deny();assert.equal(pending.attempts[0].options.signal.aborted,true);assert.deepEqual(pending.c.sessionStorage.all(),{});
});
test('withdrawal crosses current and legacy tabs without allowing legacy grants to authorize v4',()=>{
 for(const key of [CONSENT,'mft.analytics.consent.v3','mft.analytics.consent.v2',null]){
  const x=fixture({responses:['pending']});x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body');
  x.listeners.storage({key,newValue:key===null?null:'denied'});
  assert.equal(x.c.MFTAnalyticsConsent.status(),'denied');assert.equal(x.attempts[0].options.signal.aborted,true);
  assert.deepEqual(x.c.sessionStorage.all(),{});assert.equal(x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body'),false);
 }
 const current=fixture();current.c.MFTAnalyticsConsent.deny();
 for(const key of [CONSENT,'mft.analytics.consent.v3','mft.analytics.consent.v2'])assert.equal(current.c.localStorage.getItem(key),'denied');
 current.c.MFTAnalyticsConsent.grant();assert.equal(current.c.localStorage.getItem(CONSENT),'granted');
 for(const key of ['mft.analytics.consent.v3','mft.analytics.consent.v2'])assert.equal(current.c.localStorage.getItem(key),'denied','new grants do not propagate to old site versions');
 const fresh=fixture({choice:null});
 for(const key of ['mft.analytics.consent.v3','mft.analytics.consent.v2'])fresh.listeners.storage({key,newValue:'granted'});
 assert.equal(fresh.c.MFTAnalyticsConsent.status(),'unset');assert.equal(fresh.queries(),0);assert.equal(fresh.attempts.length,0);
});
test('a queued retry cannot fire after the document becomes hidden',async()=>{
 const x=fixture({responses:['reject',202]});x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body');await tick();
 x.c.document.visibilityState='hidden';x.runRetry();await tick();assert.equal(x.attempts.length,1);
});
test('first-party receipt does not depend on helper creation or Google readiness',()=>{
 const x=fixture({throwFrame:true});assert.equal(x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body'),false);
 assert.equal(x.attempts.length,1,'first-party attempt precedes optional helper work');
 const blocked=fixture();blocked.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body');assert.equal(blocked.attempts.length,1);
});
test('permitted source survives internal navigation without renewing the original deadline and expires synchronously',()=>{
 const clock={now:1800000000000};const paid=fixture({clock,search:'?utm_source=google&utm_medium=cpc&utm_campaign_id=24530528782&gclid=secret-click&utm_adgroup_id=202031516078&utm_creative_id=701234567890&email=private@example.invalid'});
 paid.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body');const saved=paid.c.sessionStorage.all();const expiry=JSON.parse(saved[SOURCE]).expiresAt;
 clock.now+=600000;const next=fixture({clock,session:saved});next.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'header');
 assert.equal(next.attempts[0].body.campaignId,'24530528782');assert.equal(JSON.parse(next.c.sessionStorage.getItem(SOURCE)).expiresAt,expiry);
 clock.now=expiry;next.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'footer');assert.equal(next.attempts[1].body.source,'direct');assert.equal(next.attempts[1].body.medium,'none');assert.equal(next.attempts[1].body.campaignId,undefined);
 const raw=JSON.stringify(paid.attempts.map(a=>a.body))+JSON.stringify(saved);
 assert.doesNotMatch(raw,/secret-click|202031516078|701234567890|example.invalid|adgroup|creative|gclid|gbraid|wbraid/);
});
test('handoff IDs stay out of the unchanged Google intent envelope and each distinct action gets a new UUID',()=>{
 const x=fixture();x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body');x.ready();
 x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body');
 assert.equal(x.attempts.length,2);assert.notEqual(x.attempts[0].body.eventId,x.attempts[1].body.eventId);
 assert.doesNotMatch(JSON.stringify(x.posts),/a0000000|occurredAt|eventId|consentVersion/);
 assert.deepEqual(x.posts.filter(p=>p.type==='mft:analytics:intent').map(p=>Object.keys(p).sort()),[ ['id','names','placement','type'],['id','names','placement','type'] ]);
});
test('UUID fallback remains cryptographic and first-party measurement fails closed without crypto',()=>{
 const fallback=fixture({cryptoMode:'bytes'});fallback.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body');
 assert.match(fallback.attempts[0].body.eventId,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
 const missing=fixture({cryptoMode:'missing'});assert.equal(missing.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body'),true);assert.equal(missing.attempts.length,0);
});
