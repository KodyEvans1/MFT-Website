'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'../src/assets');
const parentCode=fs.readFileSync(path.join(root,'mft-analytics.js'),'utf8');
const frameCode=fs.readFileSync(path.join(root,'mft-ga4-frame.js'),'utf8');
const copy=x=>JSON.parse(JSON.stringify(x));
const sourceKey='mft.analytics.source.v1',lifetime=1800000;
const campaignIds=['24274542446','24362234053','24435101888','24444626634','24449945489','24530528782','24524392745'];
const paidSuffix=campaignId=>'?utm_source=google&utm_medium=cpc&utm_campaign_id='+campaignId+'&utm_adgroup_id=202031516078&utm_creative_id=701234567890&utm_network=g&utm_device=m';
const neutralCampaign={campaign_source:'direct',campaign_medium:'none',campaign_name:'',campaign_id:''};
const fixtureDate=clock=>clock?class extends Date{static now(){return clock.now;}}:Date;
function store(seed={}){const m=new Map(Object.entries(seed));return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),all:()=>Object.fromEntries(m)};}
function parentFixture({search='',referrer='',local={},session={},gpc=false,dnt='0',origin='https://www.mft.care',clock}={}){
 const listeners={},elements=[],timers=[],sent=[];
 let queryReads=0;
 const location={origin,get search(){queryReads++;return search;}};
 const document={currentScript:{dataset:{mftMeasurementId:'G-BTK39BBNRE',mftPageKey:'0123456789abcdef',mftFrameVersion:'abcdef0123456789'}},readyState:'loading',referrer,cookie:'',
 getElementById:()=>null,addEventListener:(n,f)=>listeners['document:'+n]=f,querySelector:()=>null,
 createElement:tag=>{const e={tag,style:{},setAttribute(){},remove(){e.removed=true;},contentWindow:{postMessage:(m,o)=>sent.push({message:copy(m),origin:o})}};elements.push(e);return e;},body:{appendChild(){}}};
 const c={document,localStorage:store(local),sessionStorage:store(session),location,navigator:{globalPrivacyControl:gpc,doNotTrack:dnt},URL,URLSearchParams,Date:fixtureDate(clock),setTimeout:f=>timers.push(f),addEventListener:(n,f)=>listeners[n]=f};c.window=c;
 vm.runInNewContext(parentCode,c);
 const ready=()=>{const f=elements.find(e=>e.tag==='iframe'&&!e.removed);listeners.message({origin,source:f.contentWindow,data:{type:'mft:analytics:ready'}});return f;};
 return {c,sent,elements,timers,listeners,ready,queryReads:()=>queryReads};
}
function frameFixture({clock}={}){
 const outgoing=[],scripts=[],listeners={},timers=[];const parent={postMessage:(m,o)=>outgoing.push({message:copy(m),origin:o})};
 const c={parent,location:{origin:'https://www.mft.care'},navigator:{globalPrivacyControl:false,doNotTrack:'0'},document:{createElement:()=>({}),head:{appendChild:s=>scripts.push(s)}},setTimeout:f=>timers.push(f),Date:fixtureDate(clock),addEventListener:(n,f)=>listeners[n]=f};c.window=c;
 vm.runInNewContext(frameCode,c);
 const send=(data,extra={})=>listeners.message({origin:c.location.origin,source:parent,data,...extra});
 const init=(extra={})=>send({type:'mft:analytics:init',pageKey:'0123456789abcdef',referrer:'',sendPageView:true,source:{source:'direct',medium:'none'},sourceExpiresAt:c.Date.now()+lifetime,...extra});
 const commands=()=>Array.from(c.dataLayer||[],a=>Array.from(a));
 const events=()=>commands().filter(a=>a[0]==='event');
 return {c,outgoing,scripts,timers,send,init,commands,events};
}
test('measurement never starts before consent; unapproved events do not queue',()=>{
 const x=parentFixture({search:paidSuffix('24530528782')+'&gclid=test-click&email=private@example.invalid'});
 let released=0;x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'header',()=>released++);
 assert.equal(released,1);assert.equal(x.elements.length,0);assert.deepEqual(x.c.sessionStorage.all(),{});assert.equal(x.queryReads(),0);
 x.c.MFTAnalyticsConsent.grant();x.ready();
 assert.equal(x.queryReads(),1);assert.equal(x.sent[0].message.source.campaignId,'24530528782');
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
test('internal navigation preserves the original acquisition deadline through the exact expiry boundary',()=>{
 const clock={now:1800000000000},first=parentFixture({search:paidSuffix('24530528782'),clock});
 first.c.MFTAnalyticsConsent.grant();first.ready();
 const expiresAt=clock.now+lifetime;
 assert.equal(first.sent[0].message.sourceExpiresAt,expiresAt);
 let session=first.c.sessionStorage.all();
 for(const elapsed of [600000,1200000,lifetime-1]){
  clock.now=expiresAt-lifetime+elapsed;
  const x=parentFixture({session,referrer:'https://www.mft.care/team/',clock});x.c.MFTAnalyticsConsent.grant();x.ready();
  assert.deepEqual(x.sent[0].message.source,{source:'google',medium:'cpc',campaignId:'24530528782'});
  assert.equal(x.sent[0].message.sourceExpiresAt,expiresAt);
  session=x.c.sessionStorage.all();assert.equal(JSON.parse(session[sourceKey]).expiresAt,expiresAt);
 }
 clock.now=expiresAt;
 const expired=parentFixture({session,referrer:'https://www.mft.care/team/',clock});expired.c.MFTAnalyticsConsent.grant();expired.ready();
 assert.deepEqual(expired.sent[0].message.source,{source:'direct',medium:'none'});
 assert.doesNotMatch(JSON.stringify(expired.c.sessionStorage.all()),/24530528782/);
 first.timers.forEach(f=>f());assert.deepEqual(first.c.sessionStorage.all(),{});
});
test('a fresh explicit paid arrival starts a new bounded acquisition window',()=>{
 const clock={now:1800000000000};
 const old={source:'google',medium:'cpc',campaignId:'24530528782',expiresAt:clock.now+60000};
 const x=parentFixture({search:paidSuffix('24524392745'),session:{[sourceKey]:JSON.stringify(old)},clock});x.c.MFTAnalyticsConsent.grant();x.ready();
 assert.equal(x.sent[0].message.source.campaignId,'24524392745');
 assert.equal(x.sent[0].message.sourceExpiresAt,clock.now+lifetime);
});
test('invalid, expired or overlong stored acquisition lifetimes cannot restore attribution',()=>{
 const clock={now:1800000000000};
 for(const expiresAt of [undefined,null,String(clock.now+1000),clock.now-1,clock.now,clock.now+0.5,clock.now+lifetime+1]){
  const old={source:'google',medium:'cpc',campaignId:'24524392745',expiresAt};
  const x=parentFixture({session:{[sourceKey]:JSON.stringify(old)},clock});x.c.MFTAnalyticsConsent.grant();x.ready();
  assert.deepEqual(x.sent[0].message.source,{source:'direct',medium:'none'});
 }
});
test('consent refusal erases source state, disables the helper and releases diagnostic callbacks',()=>{
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
test('blocked frame or collector completes optional diagnostics within its bound',()=>{
 const x=parentFixture();x.c.MFTAnalyticsConsent.grant();let n=0;
 x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body',()=>n++);
 x.timers.forEach(f=>f());x.timers.forEach(f=>f());assert.equal(n,1);
});
test('the full Ads suffix recognizes all seven reviewed campaign IDs at both boundaries and drops other ad fields',()=>{
 for(const campaignId of campaignIds){
  const parent=parentFixture({search:paidSuffix(campaignId)+'&gclid=secret-click&utm_term=private-term&email=private@example.invalid'});parent.c.MFTAnalyticsConsent.grant();parent.ready();
  const message=parent.sent[0].message;
  assert.deepEqual(message.source,{source:'google',medium:'cpc',campaignId});
  assert.deepEqual(Object.keys(JSON.parse(parent.c.sessionStorage.getItem(sourceKey))).sort(),['source','medium','campaignId','expiresAt'].sort());
  const frame=frameFixture();frame.init(message);
  frame.send({type:'mft:analytics:intent',id:'m1',names:['simplepractice_exit'],placement:'body'});
  for(const event of frame.events()){
   assert.equal(event[2].campaign_source,'google');assert.equal(event[2].campaign_medium,'cpc');assert.equal(event[2].campaign_id,campaignId);
  }
  const raw=JSON.stringify(parent.sent)+JSON.stringify(parent.c.sessionStorage.all())+JSON.stringify(frame.commands());
  assert.doesNotMatch(raw,/secret-click|private-term|example.invalid|202031516078|701234567890|utm_adgroup_id|utm_creative_id|utm_network|utm_device|gclid|gbraid|wbraid/);
  assert.doesNotMatch(JSON.stringify(frame.commands()),/sourceExpiresAt|expiresAt/);
 }
});
test('unreviewed and malformed campaign IDs are rejected independently while paid source classification remains',()=>{
 for(const campaignId of ['245305287820','24524392745-private','99999999999','{campaignid}']){
  const parent=parentFixture({search:paidSuffix(campaignId)});parent.c.MFTAnalyticsConsent.grant();parent.ready();
  assert.deepEqual(parent.sent[0].message.source,{source:'google',medium:'cpc'});
  const frame=frameFixture();frame.init({source:{source:'google',medium:'cpc',campaignId}});
  const event=frame.events()[0][2];assert.equal(event.campaign_source,'google');assert.equal(event.campaign_medium,'cpc');assert.equal(event.campaign_id,'');
  assert.ok(!JSON.stringify(frame.commands()).includes(campaignId));
 }
 const frame=frameFixture();frame.init({source:{source:'google',medium:'cpc',campaignId:24530528782}});
 assert.equal(frame.events()[0][2].campaign_id,'','the helper requires the reviewed string value');
});
test('an already-open helper stops campaign attribution exactly at expiry without suppressing handoffs',()=>{
 const clock={now:1800000000000},expiresAt=clock.now+lifetime,frame=frameFixture({clock});
 frame.init({source:{source:'google',medium:'cpc',campaignId:'24524392745'},sourceExpiresAt:expiresAt});
 clock.now=expiresAt-1;
 frame.send({type:'mft:analytics:intent',id:'m1',names:['simplepractice_exit'],placement:'body'});
 assert.equal(frame.events().at(-1)[2].campaign_id,'24524392745');
 for(const now of [expiresAt,expiresAt+1]){
  clock.now=now;
  frame.send({type:'mft:analytics:intent',id:now===expiresAt?'m2':'m3',names:['appointment_request_click','simplepractice_exit'],placement:'footer'});
  for(const event of frame.events().slice(-2))for(const [key,value] of Object.entries(neutralCampaign))assert.equal(event[2][key],value);
 }
 assert.equal(frame.events().filter(e=>e[1]==='simplepractice_exit').length,3);
 const defaults=frame.commands().filter(a=>a[0]==='set'||a[0]==='config');
 for(const command of defaults)for(const [key,value] of Object.entries(neutralCampaign))assert.equal(command.at(-1)[key],value,'defaults cannot revive an expired campaign');
 assert.equal(frame.scripts.length,1);assert.equal(frame.commands().filter(a=>a[0]==='config').length,1);
 assert.doesNotMatch(JSON.stringify(frame.commands()),/sourceExpiresAt|expiresAt/);
});
test('the helper independently rejects missing, invalid, expired and overlong attribution deadlines',()=>{
 const clock={now:1800000000000};
 for(const sourceExpiresAt of [undefined,null,String(clock.now+1000),clock.now-1,clock.now,clock.now+0.5,clock.now+lifetime+1]){
  const frame=frameFixture({clock});frame.init({source:{source:'google',medium:'cpc',campaignId:'24530528782'},sourceExpiresAt});
  for(const [key,value] of Object.entries(neutralCampaign))assert.equal(frame.events()[0][2][key],value);
 }
});
test('ready frame receives an intent synchronously once without unreviewed fields',()=>{
 const x=parentFixture();x.c.MFTAnalyticsConsent.grant();const frame=x.ready();const received=[];
 frame.contentWindow.MFTAnalyticsReceiveIntent=data=>{received.push(copy(data));return true;};
 x.c.MFTSchedulingMeasurement.track(['appointment_request_click','simplepractice_exit'],'body');
 assert.deepEqual(received,[{type:'mft:analytics:intent',id:'m1',names:['appointment_request_click','simplepractice_exit'],placement:'body'}]);
 assert.equal(x.sent.length,1,'no second asynchronous dispatch for an accepted synchronous intent');
});
test('synchronous receiver has the same minimized payload, deduplication, and privacy guards',()=>{
 const x=frameFixture();x.init();
 const intent={type:'mft:analytics:intent',id:'m1',names:['simplepractice_exit'],placement:'body',clinicianId:'private-name',link_url:'https://private.example.invalid'};
 assert.equal(x.c.MFTAnalyticsReceiveIntent(intent),true);
 assert.equal(x.c.MFTAnalyticsReceiveIntent(intent),false);
 assert.equal(x.events().length,2);
 assert.doesNotMatch(JSON.stringify(x.commands()),/private-name|private.example.invalid|link_url/);
 x.c.navigator.globalPrivacyControl=true;
 assert.equal(x.c.MFTAnalyticsReceiveIntent({...intent,id:'m2'}),false);
 assert.equal(x.events().length,2);
});
function bookingFixture({track=()=>{},intent='appointment',label='Request an evaluation — assessment and insurance details',clinician=null}={}){
 const handlers={},attrs=new Map([['data-mft-booking-intent',intent]]),anchor={textContent:label,href:'https://marriagefamilytherapy.clientsecure.me/',dataset:{mftBookingIntent:intent},
  getAttribute:name=>attrs.get(name)||null,hasAttribute:name=>attrs.has(name),removeAttribute:name=>attrs.delete(name),
  setAttribute:(name,value)=>attrs.set(name,value),closest:selector=>selector.startsWith('a[')?anchor:null};
 if(clinician)attrs.set('data-mft-clinician',clinician);
 const c={document:{querySelectorAll:()=>[anchor],addEventListener:(name,fn)=>(handlers[name]||=[]).push(fn)},location:{pathname:'/'},MFTBookingCore:require('../src/booking-core'),MFT_BOOKING_CONFIG:require('../content/simplepractice-booking.json'),MFTSchedulingMeasurement:{track},HTMLDialogElement:undefined};c.window=c;
 const code=fs.readFileSync(path.join(root,'mft-booking.js'),'utf8');vm.runInNewContext(code,c);
 const click=(extra={})=>{const event={type:'click',isTrusted:true,button:0,defaultPrevented:false,target:anchor,preventDefault(){this.defaultPrevented=true;},...extra};for(const fn of handlers[event.type]||[])fn(event);return event;};
 return {c,anchor,handlers,click,reload:()=>vm.runInNewContext(code,c)};
}
test('native booking never waits for measurement, even when it throws or never completes',()=>{
 for(const track of [()=>{throw new Error('blocked optional measurement');},()=>new Promise(()=>{})]){
  const x=bookingFixture({track});const event=x.click();
  assert.equal(event.defaultPrevented,false);
  assert.equal(x.anchor.href,'https://marriagefamilytherapy.clientsecure.me/request');
 }
});
test('duplicate booking-script execution cannot install another listener or double count a native handoff',()=>{
 const calls=[],x=bookingFixture({track:(names,place)=>calls.push({names:copy(names),place})});x.reload();
 assert.equal(x.handlers.click.length,1);
 assert.equal(x.click().defaultPrevented,false);
 assert.deepEqual(calls,[{names:['appointment_request_click','simplepractice_exit'],place:'body'}]);
});
test('prevented and untrusted clicks send nothing; real middle-click keeps native behavior',()=>{
 const calls=[],x=bookingFixture({track:names=>calls.push(copy(names))});
 x.click({defaultPrevented:true});x.click({isTrusted:false});x.click({button:2});
 assert.equal(calls.length,0);
 assert.equal(x.click({type:'auxclick',button:1}).defaultPrevented,false);
 assert.deepEqual(calls,[['appointment_request_click','simplepractice_exit']]);
});
test('direct paid consultation and explicit evaluation actions retain their distinct diagnostic subtype',()=>{
 const consultations=[],consult=bookingFixture({intent:'',label:'Request a 30-minute private-pay consultation',track:names=>consultations.push(copy(names))});
 assert.equal(consult.click().defaultPrevented,false);
 assert.deepEqual(consultations,[['consultation_click','simplepractice_exit']]);
 const evaluations=[],evaluation=bookingFixture({intent:'appointment',label:'Initial individual evaluation. A consultation is optional.',track:names=>evaluations.push(copy(names))});
 assert.equal(evaluation.click().defaultPrevented,false);
 assert.deepEqual(evaluations,[['appointment_request_click','simplepractice_exit']]);
});
test('frame init is exactly once and rejects wrong origin/source',()=>{
 const x=frameFixture();x.send({type:'mft:analytics:init',pageKey:'0123456789abcdef'},{origin:'https://evil.invalid'});assert.equal(x.scripts.length,0);
 x.send({type:'mft:analytics:init',pageKey:'0123456789abcdef'},{source:{}});assert.equal(x.scripts.length,0);
 x.init();x.init();assert.equal(x.scripts.length,1);assert.equal(x.events().length,1);
});
test('frame payload scrubs URLs, arbitrary fields and unapproved campaign IDs',()=>{
 const x=frameFixture();x.init({referrer:'https://private.example.invalid/name',source:{source:'google',medium:'cpc',campaignId:'12345',email:'private@example.invalid'},pageLocation:'https://evil.invalid/'});
 const e=x.events()[0][2];assert.equal(e.page_location,'https://www.mft.care/p/0123456789abcdef/');
 assert.equal(e.campaign_source,'google');assert.equal(e.campaign_medium,'cpc');assert.equal(e.campaign_name,'mft-search');assert.equal(e.campaign_id,'');
 assert.doesNotMatch(JSON.stringify(x.commands()),/evil.invalid|example.invalid|"campaign_id":"12345"/);
});
test('approved campaign attribution and denied advertising features survive frame initialization',()=>{
 const x=frameFixture();x.init({source:{source:'google',medium:'cpc',campaignId:'24362234053'}});
 assert.equal(x.events()[0][2].campaign_id,'24362234053');
 const consent=x.commands().filter(a=>a[0]==='consent');
 assert.equal(consent[0][2].analytics_storage,'denied');assert.equal(consent[1][2].analytics_storage,'granted');
 for(const a of consent)for(const key of ['ad_storage','ad_user_data','ad_personalization'])assert.equal(a[2][key],'denied');
 const config=x.commands().find(a=>a[0]==='config')[2];assert.equal(config.allow_google_signals,false);assert.equal(config.allow_enhanced_conversions,false);assert.equal(config.allow_ad_personalization_signals,false);
 for(const command of x.commands().filter(a=>a[0]==='set'||a[0]==='config'))for(const [key,value] of Object.entries(neutralCampaign))assert.equal(command.at(-1)[key],value);
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
 const common=['send_to','page_location','page_title','page_referrer','event_callback','event_timeout',...Object.keys(neutralCampaign)];
 assert.deepEqual(Object.keys(x.events()[0][2]).sort(),common.slice().sort());
 for(const e of x.events().slice(1)){
  assert.equal(e[2].measurement_kind,'scheduling_intent');assert.equal(e[2].button_location,'dialog');
  assert.deepEqual(Object.keys(e[2]).sort(),[...common,'measurement_kind','button_location'].sort());
 }
});
