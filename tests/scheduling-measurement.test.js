'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'../src/assets');
const parentCode=fs.readFileSync(path.join(root,'mft-analytics.js'),'utf8');
const frameCode=fs.readFileSync(path.join(root,'mft-ga4-frame.js'),'utf8');
const copy=x=>JSON.parse(JSON.stringify(x));
function store(seed={}){const m=new Map(Object.entries(seed));return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),all:()=>Object.fromEntries(m)};}
function parentFixture({search='',referrer='',local={},session={},gpc=false,dnt='0',origin='https://www.mft.care'}={}){
 const listeners={},elements=[],timers=[],sent=[];
 const document={currentScript:{dataset:{mftMeasurementId:'G-BTK39BBNRE',mftPageKey:'0123456789abcdef',mftFrameVersion:'abcdef0123456789'}},readyState:'loading',referrer,cookie:'',
 getElementById:()=>null,addEventListener:(n,f)=>listeners['document:'+n]=f,querySelector:()=>null,
 createElement:tag=>{const e={tag,style:{},setAttribute(){},remove(){e.removed=true;},contentWindow:{postMessage:(m,o)=>sent.push({message:copy(m),origin:o})}};elements.push(e);return e;},body:{appendChild(){}}};
 const c={document,localStorage:store(local),sessionStorage:store(session),location:{origin,search},navigator:{globalPrivacyControl:gpc,doNotTrack:dnt},URL,URLSearchParams,Date,setTimeout:f=>timers.push(f),addEventListener:(n,f)=>listeners[n]=f};c.window=c;
 vm.runInNewContext(parentCode,c);
 const ready=()=>{const f=elements.find(e=>e.tag==='iframe'&&!e.removed);listeners.message({origin,source:f.contentWindow,data:{type:'mft:analytics:ready'}});return f;};
 return {c,sent,elements,timers,listeners,ready};
}
function frameFixture(){
 const outgoing=[],scripts=[],listeners={},timers=[];const parent={postMessage:(m,o)=>outgoing.push({message:copy(m),origin:o})};
 const c={parent,location:{origin:'https://www.mft.care'},navigator:{globalPrivacyControl:false,doNotTrack:'0'},document:{createElement:()=>({}),head:{appendChild:s=>scripts.push(s)}},setTimeout:f=>timers.push(f),Date,addEventListener:(n,f)=>listeners[n]=f};c.window=c;
 vm.runInNewContext(frameCode,c);
 const send=(data,extra={})=>listeners.message({origin:c.location.origin,source:parent,data,...extra});
 const init=(extra={})=>send({type:'mft:analytics:init',pageKey:'0123456789abcdef',referrer:'',sendPageView:true,source:{source:'direct',medium:'none'},...extra});
 const commands=()=>Array.from(c.dataLayer||[],a=>Array.from(a));
 const events=()=>commands().filter(a=>a[0]==='event');
 return {c,outgoing,scripts,timers,send,init,commands,events};
}
test('measurement never starts before consent; unapproved events do not queue',()=>{
 const x=parentFixture({search:'?gclid=test-click&email=private@example.invalid'});
 let released=0;x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'header',()=>released++);
 assert.equal(released,1);assert.equal(x.elements.length,0);assert.deepEqual(x.c.sessionStorage.all(),{});
});
test('old visit-only permission is not inherited for scheduling; old refusal is respected',()=>{
 assert.equal(parentFixture({local:{'mft.analytics.consent.v2':'granted'}}).c.MFTAnalyticsConsent.status(),'unset');
 assert.equal(parentFixture({local:{'mft.analytics.consent.v2':'denied'}}).c.MFTAnalyticsConsent.status(),'denied');
});
test('paid source sends only allowlisted source, medium, known campaign ID',()=>{
 const x=parentFixture({search:'?utm_source=google&utm_medium=cpc&utm_campaign_id=24362234053&gclid=secret-click&utm_term=private-term&email=private@example.invalid&utm_adgroup_id=202031516078'});
 x.c.MFTAnalyticsConsent.grant();x.ready();
 assert.deepEqual(x.sent[0].message.source,{source:'google',medium:'cpc',campaignId:'24362234053'});
 assert.doesNotMatch(JSON.stringify(x.sent)+JSON.stringify(x.c.sessionStorage.all()),/secret-click|private-term|example.invalid|202031516078/);
});
test('click marker classification does not transmit click identifier or accept an unknown campaign',()=>{
 const x=parentFixture({search:'?gclid=some-token&utm_campaign_id=123456789'});x.c.MFTAnalyticsConsent.grant();x.ready();
 assert.deepEqual(x.sent[0].message.source,{source:'google',medium:'cpc'});
 assert.doesNotMatch(JSON.stringify(x.sent),/some-token|"campaignId":"123456789"/);
});
test('arbitrary source text is normalized, not passed through',()=>{
 const x=parentFixture({search:'?utm_source=private@example.invalid&utm_medium=patient'});x.c.MFTAnalyticsConsent.grant();x.ready();
 assert.deepEqual(x.sent[0].message.source,{source:'other',medium:'unknown'});
});
test('consented acquisition persists across an internal page, with expiry',()=>{
 const a={source:'google',medium:'cpc',campaignId:'24362234053',expiresAt:Date.now()+600000};
 const x=parentFixture({session:{'mft.analytics.source.v1':JSON.stringify(a)},referrer:'https://www.mft.care/team/'});x.c.MFTAnalyticsConsent.grant();x.ready();
 assert.equal(x.sent[0].message.source.medium,'cpc');a.expiresAt=Date.now()-1;
 const y=parentFixture({session:{'mft.analytics.source.v1':JSON.stringify(a)}});y.c.MFTAnalyticsConsent.grant();y.ready();
 assert.deepEqual(y.sent[0].message.source,{source:'direct',medium:'none'});
});
test('consent refusal erases source state, disables the helper and releases navigation callbacks',()=>{
 const x=parentFixture();x.c.MFTAnalyticsConsent.grant();x.ready();let n=0;
 x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'header',()=>n++);x.c.MFTAnalyticsConsent.deny();
 assert.equal(n,1);assert.deepEqual(x.c.sessionStorage.all(),{});assert.equal(x.elements[0].removed,true);
 assert.equal(x.elements[0].contentWindow['ga-disable-G-BTK39BBNRE'],true);
 x.timers.forEach(f=>f());assert.equal(n,1);
});
test('GPC, DNT and nonproduction origins cannot start measurement',()=>{
 for(const options of [{gpc:true},{dnt:'1'}]){const x=parentFixture(options);x.c.MFTAnalyticsConsent.grant();assert.equal(x.elements.length,0);assert.equal(x.c.MFTAnalyticsConsent.status(),'denied');}
 assert.equal(parentFixture({origin:'https://preview.example.invalid'}).c.MFTSchedulingMeasurement,undefined);
});
test('parent intent allowlist deduplicates names and never accepts placement free text',()=>{
 const x=parentFixture();x.c.MFTAnalyticsConsent.grant();x.ready();
 x.c.MFTSchedulingMeasurement.track(['simplepractice_exit','simplepractice_exit','appointment_booked'],'body');
 assert.deepEqual(x.sent[1].message.names,['simplepractice_exit']);
 x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'private@example.invalid');assert.equal(x.sent.length,2);
});
test('blocked frame or collector cannot hold navigation indefinitely',()=>{
 const x=parentFixture();x.c.MFTAnalyticsConsent.grant();let n=0;
 x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body',()=>n++);
 x.timers.forEach(f=>f());x.timers.forEach(f=>f());assert.equal(n,1);
});
test('frame init is exactly once and rejects wrong origin/source',()=>{
 const x=frameFixture();x.send({type:'mft:analytics:init',pageKey:'0123456789abcdef'},{origin:'https://evil.invalid'});assert.equal(x.scripts.length,0);
 x.send({type:'mft:analytics:init',pageKey:'0123456789abcdef'},{source:{}});assert.equal(x.scripts.length,0);
 x.init();x.init();assert.equal(x.scripts.length,1);assert.equal(x.events().length,1);
});
test('frame payload scrubs URLs, arbitrary fields and unapproved campaign IDs',()=>{
 const x=frameFixture();x.init({referrer:'https://private.example.invalid/name',source:{source:'google',medium:'cpc',campaignId:'12345',email:'private@example.invalid'},pageLocation:'https://evil.invalid/'});
 const e=x.events()[0][2];assert.equal(e.page_location,'https://www.mft.care/p/0123456789abcdef/');
 assert.equal(e.campaign_source,'google');assert.equal(e.campaign_medium,'cpc');assert.equal(e.campaign_name,'mft-search');assert.equal(e.campaign_id,undefined);
 assert.doesNotMatch(JSON.stringify(x.commands()),/evil.invalid|example.invalid|"campaign_id":"12345"/);
});
test('approved campaign attribution and denied advertising features survive frame initialization',()=>{
 const x=frameFixture();x.init({source:{source:'google',medium:'cpc',campaignId:'24362234053'}});
 assert.equal(x.events()[0][2].campaign_id,'24362234053');
 const consent=x.commands().filter(a=>a[0]==='consent');
 assert.equal(consent[0][2].analytics_storage,'denied');assert.equal(consent[1][2].analytics_storage,'granted');
 for(const a of consent)for(const key of ['ad_storage','ad_user_data','ad_personalization'])assert.equal(a[2][key],'denied');
 const config=x.commands().find(a=>a[0]==='config')[2];assert.equal(config.allow_google_signals,false);assert.equal(config.allow_enhanced_conversions,false);
});
test('intent after page-view completion retains active consent and duplicate batch cannot double count',()=>{
 const x=frameFixture();x.init();x.events()[0][2].event_callback();assert.notEqual(x.c['ga-disable-G-BTK39BBNRE'],true);
 const batch={type:'mft:analytics:intent',id:'m1',names:['appointment_request_click','simplepractice_exit'],placement:'header',clinicianId:'private-name',gclid:'private-token'};
 x.send(batch);x.send(batch);assert.equal(x.events().length,3);
 for(const e of x.events().slice(1))e[2].event_callback();x.timers.forEach(f=>f());
 assert.notEqual(x.c['ga-disable-G-BTK39BBNRE'],true);assert.equal(x.outgoing.filter(e=>e.message.type==='mft:analytics:ack').length,1);
 assert.doesNotMatch(JSON.stringify(x.commands()),/private-name|private-token/);
});
test('frame rejects completed booking names, free-text placement and extra duplicate calls',()=>{
 const x=frameFixture();x.init();
 x.send({type:'mft:analytics:intent',id:'m1',names:['appointment_booked','generate_lead','purchase'],placement:'body'});
 x.send({type:'mft:analytics:intent',id:'m2',names:['simplepractice_exit'],placement:'Kody-private'});
 assert.equal(x.events().length,1);
});
test('all supported intent names are observation-only and contain no clinical identity field',()=>{
 const x=frameFixture();x.init();x.send({type:'mft:analytics:intent',id:'m1',names:['appointment_request_click','clinician_schedule_click','consultation_click','simplepractice_exit'],placement:'dialog'});
 assert.equal(x.events().length,5);
 for(const e of x.events().slice(1)){assert.equal(e[2].measurement_kind,'scheduling_intent');assert.equal(e[2].button_location,'dialog');assert.equal(e[2].clinician_slug,undefined);assert.equal(e[2].link_url,undefined);}
});
