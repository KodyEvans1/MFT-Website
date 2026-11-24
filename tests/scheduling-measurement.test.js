/* Runtime/source/consent regressions; all delivery is a synthetic VM stub. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {fixture,copy,CONSENT,RECEIVING_CONSENT,ADVERTISING,SOURCE}=require('./fixtures/first-party-measurement');
const root=path.join(__dirname,'../src/assets');
const lifetime=1800000;
const campaignIds=['24274542446','24362234053','24435101888','24444626634','24449945489','24530528782','24524392745'];
const paidSuffix=campaignId=>'?utm_source=google&utm_medium=cpc&utm_campaign_id='+campaignId+'&utm_adgroup_id=202031516078&utm_creative_id=701234567890&utm_network=g&utm_device=m';
const source=x=>JSON.parse(x.c.sessionStorage.getItem(SOURCE));
function noGoogle(x){
 assert.equal(x.googleCalls.length,0);assert.equal(x.posts.length,0);assert.equal(x.c.dataLayer,undefined);
 assert.equal(x.elements.filter(e=>['iframe','script'].includes(e.tag)).length,0);
 assert.equal(x.c['ga-disable-G-BTK39BBNRE'],true);
 assert.equal(x.c.MFTAnalyticsConsent.advertisingStatus(),'unavailable');
 assert.equal(x.c.MFTAdvertisingConsent.status(),'unavailable');
 assert.equal(x.c.localStorage.getItem(ADVERTISING),'denied');
}
test('no source read, identifier generation or delivery before consent, including account acknowledgment and dismissal',()=>{
 const ACK='mft.newClientAccountAcknowledgment.v1';
 const x=fixture({choice:null,local:{[ACK]:'acknowledged'},search:paidSuffix(campaignIds[0])+'&gclid=secret-click'});
 x.setup();let released=0;x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'header',()=>released++);
 const banner=x.elements.find(e=>e.id==='mft-analytics-consent');assert.ok(banner);
 banner.handlers.click({target:{dataset:{choice:'dismiss'}}});
 assert.equal(x.c.MFTAnalyticsConsent.status(),'unset');assert.equal(x.c.localStorage.getItem(CONSENT),null);
 assert.equal(x.c.localStorage.getItem(ACK),'acknowledged');assert.equal(x.queries(),0);assert.equal(x.ids(),0);
 assert.equal(x.attempts.length,0);assert.equal(released,1);assert.deepEqual(x.c.sessionStorage.all(),{});noGoogle(x);
});
test('a fresh first-party grant never authorizes Google or writes a grant to an older Google-capable tab key',()=>{
 const x=fixture({choice:null,search:paidSuffix(campaignIds[0])});
 x.c.MFTAnalyticsConsent.grant();x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body');
 assert.equal(x.c.localStorage.getItem(CONSENT),'granted');assert.equal(x.attempts.length,1);
 for(const key of ['mft.analytics.consent.v4','mft.analytics.consent.v3','mft.analytics.consent.v2']){
  assert.equal(x.c.localStorage.writes.some(w=>w.key===key&&w.value==='granted'),false);
  assert.equal(x.c.localStorage.getItem(key),null);
 }
 assert.equal(x.attempts[0].body.consentVersion,RECEIVING_CONSENT,'receiver contract stays independently versioned');noGoogle(x);
});
test('v4 first-party permission migrates to the narrower v5 scope but never advertising',()=>{
 for(const permission of ['granted','denied']){
  const x=fixture({choice:null,local:{[RECEIVING_CONSENT]:permission,[ADVERTISING]:'granted'}});
  x.setup();assert.equal(x.c.MFTAnalyticsConsent.status(),permission);assert.equal(x.c.localStorage.getItem(CONSENT),permission);
  x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body');
  assert.equal(x.attempts.length,permission==='granted'?1:0);noGoogle(x);
 }
});
test('older Google-only grants do not become first-party permission; the latest valid refusal remains authoritative',()=>{
 for(const key of ['mft.analytics.consent.v2','mft.analytics.consent.v3']){
  const x=fixture({choice:null,local:{[key]:'granted'}});x.setup();
  assert.equal(x.c.MFTAnalyticsConsent.status(),'unset');assert.equal(x.queries(),0);assert.equal(x.attempts.length,0);noGoogle(x);
  const refused=fixture({choice:null,local:{[key]:'denied'}});refused.setup();
  assert.equal(refused.c.MFTAnalyticsConsent.status(),'denied');assert.equal(refused.queries(),0);noGoogle(refused);
 }
 const cases=[
  [{'mft.analytics.consent.v3':'granted','mft.analytics.consent.v2':'denied'},'unset'],
  [{[RECEIVING_CONSENT]:'denied','mft.analytics.consent.v3':'granted'},'denied'],
  [{[RECEIVING_CONSENT]:'granted','mft.analytics.consent.v3':'denied'},'granted'],
  [{[CONSENT]:'denied',[RECEIVING_CONSENT]:'granted'},'denied'],
  [{[CONSENT]:'granted',[RECEIVING_CONSENT]:'denied'},'granted']
 ];
 for(const [local,expected]of cases){const x=fixture({choice:null,local});x.setup();assert.equal(x.c.MFTAnalyticsConsent.status(),expected);noGoogle(x);}
});
test('a stale advertising grant is discarded without reviving it, changing analytics permission, or loading Google',()=>{
 const x=fixture({local:{[ADVERTISING]:'granted'}});x.setup();noGoogle(x);
 x.c.localStorage.setItem(ADVERTISING,'granted');x.listeners.storage({key:ADVERTISING,newValue:'granted'});
 assert.equal(x.c.MFTAnalyticsConsent.status(),'granted');noGoogle(x);
 assert.equal(x.c.MFTAdvertisingConsent.grant,undefined);
 x.c.MFTAdvertisingConsent.deny();x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body');
 assert.equal(x.attempts.length,1);noGoogle(x);
});
test('old and hypothetical future Google mode attributes cannot enable an unapproved sender',()=>{
 for(const mftGoogleMode of ['iframe','main-page','enabled','disabled','unexpected']){
  const x=fixture({dataset:{mftGoogleMode,mftMeasurementId:'G-BTK39BBNRE',mftFrameVersion:'abcdef0123456789'},blockGoogle:true});
  x.setup();x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'dialog');
  assert.equal(x.attempts.length,1);assert.equal(x.listeners.message,undefined);noGoogle(x);
 }
});
test('all seven campaign labels stay internal and all other raw advertising or personal fields are discarded',()=>{
 for(const campaignId of campaignIds){
  const x=fixture({search:paidSuffix(campaignId)+'&gclid=secret-click&utm_term=private-term&email=private@example.invalid'});
  x.setup();x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body');
  assert.deepEqual(source(x),{source:'google',medium:'cpc',campaignId,expiresAt:x.clock.now+lifetime});
  const payload=x.attempts[0].body;assert.equal(payload.campaignId,campaignId);
  const raw=JSON.stringify(payload)+JSON.stringify(x.c.sessionStorage.all());
  assert.doesNotMatch(raw,/secret-click|private-term|example.invalid|202031516078|701234567890|utm_adgroup_id|utm_creative_id|utm_network|utm_device|gclid|gbraid|wbraid/);noGoogle(x);
 }
});
test('click markers supply only an internal paid label; they are never retained as Ads attribution',()=>{
 for(const marker of ['gclid','gbraid','wbraid']){
  const x=fixture({search:'?'+marker+'=secret-click&utm_campaign_id=123456789'});x.setup();x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body');
  assert.deepEqual(source(x),{source:'google',medium:'cpc',expiresAt:x.clock.now+lifetime});
  assert.doesNotMatch(JSON.stringify(x.attempts[0].body)+JSON.stringify(x.c.sessionStorage.all()),/secret-click|gclid|gbraid|wbraid/);noGoogle(x);
 }
});
test('unreviewed campaign IDs and arbitrary source text cannot enter internal attribution fields',()=>{
 for(const campaignId of ['245305287820','24524392745-private','99999999999','{campaignid}']){
  const x=fixture({search:paidSuffix(campaignId)});x.setup();assert.equal(source(x).campaignId,undefined);assert.equal(source(x).source,'google');noGoogle(x);
 }
 const x=fixture({search:'?utm_source=private@example.invalid&utm_medium=patient'});x.setup();
 assert.deepEqual(source(x),{source:'other',medium:'unknown',expiresAt:x.clock.now+lifetime});
});
test('internal navigation keeps the original 30-minute deadline through exact expiry',()=>{
 const clock={now:1800000000000},first=fixture({search:paidSuffix(campaignIds[0]),clock});first.setup();
 const expiry=clock.now+lifetime;let session=first.c.sessionStorage.all();
 for(const elapsed of [600000,1200000,lifetime-1]){
  clock.now=expiry-lifetime+elapsed;const x=fixture({session,referrer:'https://www.mft.care/team/',clock});x.setup();
  assert.equal(source(x).campaignId,campaignIds[0]);assert.equal(source(x).expiresAt,expiry);session=x.c.sessionStorage.all();
 }
 clock.now=expiry;first.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'footer');
 assert.equal(first.attempts[0].body.source,'direct');assert.equal(first.attempts[0].body.campaignId,undefined);
 assert.deepEqual(first.c.sessionStorage.all(),{});
 const expired=fixture({session,clock});expired.setup();assert.equal(source(expired).source,'direct');assert.equal(source(expired).campaignId,undefined);
});
test('source expiration clears storage even without a handoff and an explicit new arrival gets a bounded new window',()=>{
 const x=fixture({search:paidSuffix(campaignIds[0])});x.setup();x.clock.now+=lifetime;x.runTimers();
 assert.deepEqual(x.c.sessionStorage.all(),{});noGoogle(x);
 const old={source:'google',medium:'cpc',campaignId:campaignIds[0],expiresAt:x.clock.now+60000};
 const next=fixture({clock:x.clock,search:paidSuffix(campaignIds[1]),session:{[SOURCE]:JSON.stringify(old)}});next.setup();
 assert.equal(source(next).campaignId,campaignIds[1]);assert.equal(source(next).expiresAt,x.clock.now+lifetime);
});
test('an older document expiration timer cannot remove a newer navigation source',()=>{
 const x=fixture({search:paidSuffix(campaignIds[0])});x.setup();
 const newer={source:'google',medium:'cpc',campaignId:campaignIds[1],expiresAt:x.clock.now+lifetime+60000};
 x.c.sessionStorage.setItem(SOURCE,JSON.stringify(newer));x.clock.now+=lifetime;x.runTimers();
 assert.deepEqual(source(x),newer);
});
test('invalid, expired and overlong source deadlines cannot restore a campaign',()=>{
 const clock={now:1800000000000};
 for(const expiresAt of [undefined,null,String(clock.now+1000),clock.now-1,clock.now,clock.now+0.5,clock.now+lifetime+1]){
  const x=fixture({clock,session:{[SOURCE]:JSON.stringify({source:'google',medium:'cpc',campaignId:campaignIds[0],expiresAt})}});x.setup();
  assert.equal(source(x).source,'direct');assert.equal(source(x).campaignId,undefined);
 }
});
test('source expires synchronously even when a background timer has not fired',()=>{
 const x=fixture({search:paidSuffix(campaignIds[0])});x.setup();x.clock.now+=lifetime;
 x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body');
 assert.equal(x.attempts[0].body.source,'direct');assert.equal(x.attempts[0].body.medium,'none');assert.equal(x.attempts[0].body.campaignId,undefined);
 assert.deepEqual(x.c.sessionStorage.all(),{});noGoogle(x);
});
test('withdrawal erases controlled source and Google cookies without changing functional account state',()=>{
 const ACK='mft.newClientAccountAcknowledgment.v1';
 const x=fixture({local:{[ACK]:'acknowledged'},cookies:{mftga_ga:'legacy',mftga_ga_BTK39BBNRE:'legacy',_ga:'legacy',_gcl_aw:'legacy',functional:'keep'},search:paidSuffix(campaignIds[0])});
 x.setup();x.c.MFTAnalyticsConsent.deny();
 assert.equal(x.c.document.cookie,'functional=keep');assert.deepEqual(x.c.sessionStorage.all(),{});
 assert.equal(x.c.localStorage.getItem(ACK),'acknowledged');
 assert.ok(x.cookieWrites.some(v=>v.includes('Domain=mft.care')));assert.ok(x.cookieWrites.some(v=>!v.includes('Domain=')));
 for(const key of [CONSENT,RECEIVING_CONSENT,'mft.analytics.consent.v3','mft.analytics.consent.v2'])assert.equal(x.c.localStorage.getItem(key),'denied');noGoogle(x);
});
test('GPC and DNT override old and current grants and clear source without query reads',()=>{
 for(const signal of [{gpc:true},{dnt:'1'}]){
  const x=fixture({...signal,local:{[ADVERTISING]:'granted'},search:paidSuffix(campaignIds[0]),session:{[SOURCE]:'old-state'}});x.setup();x.c.MFTAnalyticsConsent.grant();
  assert.equal(x.c.MFTAnalyticsConsent.status(),'denied');assert.equal(x.queries(),0);assert.equal(x.ids(),0);assert.equal(x.attempts.length,0);
  assert.deepEqual(x.c.sessionStorage.all(),{});noGoogle(x);
 }
 assert.equal(fixture({origin:'https://preview.example.invalid'}).c.MFTSchedulingMeasurement,undefined);
});
test('a newly enabled browser privacy signal cancels optional delivery and clears prior acquisition',()=>{
 const x=fixture({responses:['pending'],search:paidSuffix(campaignIds[0])});x.setup();x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body');
 x.c.navigator.globalPrivacyControl=true;x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body');
 assert.equal(x.attempts.length,1);assert.equal(x.attempts[0].options.signal.aborted,true);assert.deepEqual(x.c.sessionStorage.all(),{});noGoogle(x);
});
test('blocked browser storage and missing fetch never block the controller or local completion callback',()=>{
 const x=fixture({choice:null,blockedStorage:true});x.setup();x.c.MFTAnalyticsConsent.grant();delete x.c.fetch;
 let completed=0;assert.equal(x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body',()=>completed++),true);
 assert.equal(completed,1);assert.equal(x.attempts.length,0);assert.equal(x.elements.filter(e=>['iframe','script'].includes(e.tag)).length,0);
});
test('cookie access failure does not interrupt a privacy choice or permitted handoff',()=>{
 const x=fixture();
 Object.defineProperty(x.c.document,'cookie',{get(){throw Error('Cookie access blocked');},set(){throw Error('Cookie access blocked');}});
 x.c.MFTAnalyticsConsent.deny();assert.equal(x.c.MFTAnalyticsConsent.status(),'denied');
 x.c.MFTAnalyticsConsent.grant();x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body');
 assert.equal(x.attempts.length,1);noGoogle(x);
});
test('diagnostics stay local, unsupported outcome names are rejected, and repeated event names yield one handoff',()=>{
 const x=fixture();
 for(const name of ['consultation_click','clinician_schedule_click','appointment_request_click'])assert.equal(x.c.MFTSchedulingMeasurement.track([name],'body'),true);
 assert.equal(x.attempts.length,0);assert.equal(x.ids(),0);
 for(const names of [['appointment_booked'],['generate_lead','purchase'],['accepted_appointment'],[]])assert.equal(x.c.MFTSchedulingMeasurement.track(names,'body'),false);
 assert.equal(x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'private@example.invalid'),false);
 x.c.MFTSchedulingMeasurement.track(['simplepractice_exit','simplepractice_exit','appointment_request_click'],'dialog');assert.equal(x.attempts.length,1);noGoogle(x);
});
test('duplicate controller execution cannot register another sender',()=>{
 const x=fixture();const original=x.c.MFTSchedulingMeasurement;const storageListener=x.listeners.storage;x.reload();
 assert.equal(x.c.MFTSchedulingMeasurement,original);assert.equal(x.listeners.storage,storageListener);
 x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body');assert.equal(x.attempts.length,1);noGoogle(x);
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
