/* Synthetic approved-config fixtures only. These tests establish neither a
 * production policy review, vendor-network behavior nor Google Ads receipt. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assets=path.join(__dirname,'../src/assets');
const googleCode=fs.readFileSync(path.join(assets,'mft-google-measurement.js'),'utf8');
const opsCode=fs.readFileSync(path.join(assets,'mft-analytics.js'),'utf8');
const REVIEW='a'.repeat(64),CONSENT='mft.advertising.consent.v2',SOURCE='mft.google.source.v1';
const OPS_CONSENT='mft.analytics.consent.v5',OPS_SOURCE='mft.analytics.source.v1',LIFETIME=1800000;
const TITLES={'/':'Marriage.Family.Therapy | Woodinville & Online in Washington','/about/':'About Marriage.Family.Therapy | Woodinville, WA'};
const copy=value=>JSON.parse(JSON.stringify(value));
function store(seed={},blocked=false){
 const values=new Map(Object.entries(seed)),writes=[];
 return {getItem:key=>{if(blocked)throw Error('Storage blocked');return values.get(key)??null;},setItem:(key,value)=>{if(blocked)throw Error('Storage blocked');values.set(key,String(value));writes.push({key,value:String(value)});},removeItem:key=>{if(blocked)throw Error('Storage blocked');values.delete(key);},all:()=>Object.fromEntries(values),writes};
}
function fixture({route='/',pathname=route,origin='https://www.mft.care',title=TITLES[route],search='',hash='',dataset={},local={},session={},cookies={},clock={now:1800000000000},gpc=false,dnt='0',blockedStorage=false,otherSender=false,controls=[]}={}){
 const listeners={},registrations=[],observers=[],elements=[],loaders=[],headElements=[],timers=[],ops=[],cookieWrites=[];let queryReads=0,reloads=0,ids=0;
 const jar=new Map(Object.entries(cookies));
 const listen=(target,name,fn,options)=>{(listeners[target+':'+name]||=[]).push(fn);registrations.push({target,name,fn,capture:options===true||options?.capture===true});};
 const document={readyState:'loading',visibilityState:'visible',title,referrer:'https://private.example.invalid/patient',documentElement:{},
  currentScript:{dataset:{mftGoogleMode:'approved-main-page',mftGoogleMeasurementId:'G-BTK39BBNRE',mftGoogleRoute:route,mftGoogleEvent:'simplepractice_exit',mftGoogleApprovedReview:REVIEW,...dataset}},
  get cookie(){return [...jar].map(([k,v])=>k+'='+v).join('; ');},set cookie(value){cookieWrites.push(value);if(value.includes('Max-Age=0'))jar.delete(value.split('=')[0]);},
  getElementById:id=>elements.find(e=>e.id===id&&!e.removed)||null,querySelector:()=>null,
  querySelectorAll:selector=>selector==='form,input,textarea'?controls:elements.filter(e=>!e.removed&&['script','iframe'].includes(e.tag)),
  addEventListener:(name,fn,options)=>listen('document',name,fn,options),
  createElement:tag=>{const handlers={},attributes=new Map();const element={tag,style:{},handlers,src:'',setAttribute:(key,value)=>attributes.set(key,String(value)),getAttribute:key=>attributes.get(key)??null,addEventListener:(name,fn)=>(handlers[name]||=[]).push(fn),remove(){element.removed=true;},querySelector:()=>({focus(){},remove(){}})};elements.push(element);return element;},
  body:{appendChild(){}},head:{appendChild:element=>{headElements.push(element);if(element.tag==='script')loaders.push(element);}}};
 const c={document,location:{origin,pathname,get search(){queryReads++;return search;},set search(value){search=value;},hash,reload:()=>reloads++},
  navigator:{globalPrivacyControl:gpc,doNotTrack:dnt},localStorage:store(local,blockedStorage),sessionStorage:store(session,blockedStorage),URL,URLSearchParams,AbortController,Uint8Array,
  Date:class extends Date{constructor(...args){super(...(args.length?args:[clock.now]));}static now(){return clock.now;}},
  setTimeout:(fn,delay)=>{timers.push({fn,at:clock.now+delay});return timers.length;},addEventListener:(name,fn,options)=>listen('window',name,fn,options),
  MutationObserver:class{constructor(callback){this.callback=callback;observers.push(this);}observe(target,options){this.target=target;this.options=options;}disconnect(){this.disconnected=true;}},
  crypto:{getRandomValues:b=>b.fill(1),randomUUID:()=> 'a0000000-0000-4000-8000-'+String(++ids).padStart(12,'0')},
  fetch:(url,options)=>{assert.equal(url,'https://ops.mft.care/api/marketing/attribution');ops.push({url,options,body:JSON.parse(options.body)});return Promise.resolve({status:202});}};
 if(otherSender)c.gtag=function(){};
 c.window=c;vm.runInNewContext(googleCode,c);
 const fire=(target,name,event={})=>{for(const fn of listeners[target+':'+name]||[])fn(event);};
 return {c,document,clock,loaders,headElements,elements,ops,jar,cookieWrites,registrations,observers,queryReads:()=>queryReads,reloads:()=>reloads,
  fire,commands:()=>Array.from(c.dataLayer||[],args=>Array.from(args)),
  mutate:()=>{for(const observer of observers)if(observer.target&&!observer.disconnected)observer.callback([]);},
  load:()=>{for(const fn of loaders.at(-1)?.handlers.load||[])fn();},
  fail:()=>{for(const fn of loaders.at(-1)?.handlers.error||[])fn();},
  advance:milliseconds=>{clock.now+=milliseconds;for(const timer of timers){if(!timer.ran&&timer.at<=clock.now){timer.ran=true;timer.fn();}}},
  addOps:({endpoint=true}={})=>{document.currentScript={dataset:{mftMeasurementController:'first-party',mftGoogleMode:'disabled',mftPageKey:'0123456789abcdef',...(endpoint?{mftHandoffEndpoint:'https://ops.mft.care/api/marketing/attribution'}:{})}};vm.runInNewContext(opsCode,c);fire('document','DOMContentLoaded');},
  rerunGoogle:()=>vm.runInNewContext(googleCode,c)};
}
const events=x=>x.commands().filter(command=>command[0]==='event');
const stopPolicies=x=>x.headElements.filter(element=>element.tag==='meta'&&element.getAttribute('data-mft-google-stopped')==='true');
const grantRecord=now=>JSON.stringify({choice:'granted',review:REVIEW,expiresAt:now+LIFETIME});

test('a script asset is inert without the exact reviewed route/event/destination assertion',()=>{
 for(const options of [{origin:'https://preview.example.invalid'},{route:'/gary-ashley/'},{pathname:'/about/'},
  {dataset:{mftGoogleMode:'disabled'}},{dataset:{mftGoogleEvent:'generate_lead'}},
  {dataset:{mftGoogleMeasurementId:'G-OTHER'}},{dataset:{mftGoogleApprovedReview:''}}]){
  const x=fixture(options);assert.equal(x.c.MFTGoogleMeasurement,undefined);assert.equal(x.loaders.length,0);assert.equal(x.queryReads(),0);assert.equal(x.c.dataLayer,undefined);
 }
});
test('only exact reviewed public document titles can authorize or load the Google runtime',()=>{
 for(const route of ['/','/about/']){
  for(const title of ['', 'Private patient canary', TITLES[route]+' - private canary', TITLES[route].replace('Therapy','THERAPY')]){
   const x=fixture({route,title,search:'?gclid=synthetic-click'});
   assert.equal(x.c.MFTGoogleMeasurement.status(),'unavailable');assert.equal(x.c.MFTGoogleMeasurement.grant(),false);
   assert.equal(x.c.localStorage.getItem(CONSENT),null);assert.equal(x.loaders.length,0);assert.equal(x.queryReads(),0);assert.equal(x.c.dataLayer,undefined);
  }
  const saved=fixture({route,title:'Private patient canary',local:{[CONSENT]:grantRecord(1800000000000)},search:'?gclid=synthetic-click'});
  assert.equal(saved.loaders.length,0);assert.equal(saved.queryReads(),0);assert.equal(saved.c.MFTGoogleMeasurement.handoff(),false);
  assert.equal(saved.c.localStorage.getItem(CONSENT),grantRecord(1800000000000),'an ineligible document must not rewrite valid purpose permission');
 }
});
test('title changes before consent or vendor readiness fail closed without rewriting the document',()=>{
 const before=fixture();before.document.title='Private title';assert.equal(before.c.MFTGoogleMeasurement.grant(),false);
 assert.equal(before.c.localStorage.getItem(CONSENT),null);assert.equal(before.loaders.length,0);
 const pending=fixture();pending.c.MFTGoogleMeasurement.grant();pending.document.title='Private pending title';pending.load();
 assert.equal(pending.c.MFTGoogleMeasurement.handoff(),false);assert.equal(pending.c['ga-disable-G-BTK39BBNRE'],true);
 assert.equal(pending.document.title,'Private pending title');assert.equal(pending.loaders[0].removed,true);
});
test('live title and form changes halt immediately on handoff or lifecycle events before observer delivery',()=>{
 for(const trigger of ['handoff','hidden','pagehide','observer']){
  const x=fixture();x.c.MFTGoogleMeasurement.grant();x.load();
  x.document.title='Private changed title';
  if(trigger==='handoff')assert.equal(x.c.MFTGoogleMeasurement.handoff(),false);
  else if(trigger==='hidden'){x.document.visibilityState='hidden';x.fire('document','visibilitychange');}
  else if(trigger==='pagehide')x.fire('window','pagehide');
  else x.mutate();
  assert.equal(x.c['ga-disable-G-BTK39BBNRE'],true);assert.equal(x.c.MFTGoogleMeasurement.handoff(),false);
  x.document.title=TITLES['/'];x.mutate();assert.equal(x.c.MFTGoogleMeasurement.handoff(),false,'restoring the title cannot revive a halted vendor');
  assert.equal(x.reloads(),0);assert.deepEqual(events(x),[]);
  for(const [target,name]of [['document','visibilitychange'],['window','pagehide']])assert.ok(x.registrations.find(r=>r.target===target&&r.name===name&&r.capture));
  const observer=x.observers[0];assert.equal(observer.target,x.document.documentElement);assert.equal(observer.options.characterData,true);assert.equal(observer.options.attributes,true);
 }
 const controls=[],x=fixture({controls});x.c.MFTGoogleMeasurement.grant();x.load();
 controls.push({closest:()=>null,matches:()=>false});x.fire('window','pagehide');
 assert.equal(x.c['ga-disable-G-BTK39BBNRE'],true);assert.equal(x.c.MFTGoogleMeasurement.handoff(),false);
});
test('old analytics grants and the unavailable-purpose v1 default never authorize the new purpose',()=>{
 for(const local of [{[OPS_CONSENT]:'granted'},{'mft.analytics.consent.v4':'granted'},
  {'mft.advertising.consent.v1':'denied'},{'mft.advertising.consent.v1':'granted'},{[CONSENT]:'granted'}]){
  const x=fixture({local,search:'?gclid=synthetic-click'});
  assert.equal(x.c.MFTGoogleMeasurement.status(),'unset');assert.equal(x.c.MFTGoogleMeasurement.handoff(),false);
  assert.equal(x.queryReads(),0);assert.equal(x.loaders.length,0);assert.equal(x.c.dataLayer,undefined);assert.deepEqual(x.c.sessionStorage.all(),{});
 }
});
test('a real new-purpose refusal persists and a grant for another review cannot activate this review',()=>{
 for(const [value,expected]of [[{choice:'denied'},'denied'],[{choice:'granted',review:'b'.repeat(64),expiresAt:1800001800000},'unset']]){
  const x=fixture({local:{[CONSENT]:JSON.stringify(value)}});
  assert.equal(x.c.MFTGoogleMeasurement.status(),expected);assert.equal(x.loaders.length,0);assert.equal(x.queryReads(),0);
 }
});
test('basic blocking orders defaults before configuration and configures one sender without automatic pageviews',()=>{
 const x=fixture({search:'?gclid=synthetic-click&utm_source=google&utm_medium=cpc&utm_campaign_id=24530528782&utm_adgroup_id=123456&utm_creative_id=654321&utm_network=g&utm_device=m'});
 assert.equal(x.loaders.length,0);assert.equal(x.c.MFTGoogleMeasurement.grant(),true);
 assert.equal(x.loaders.length,1);assert.equal(x.loaders[0].src,'https://www.googletagmanager.com/gtag/js?id=G-BTK39BBNRE');assert.equal(x.loaders[0].referrerPolicy,'no-referrer');
 const commands=x.commands();assert.equal(commands[0][0],'consent');assert.equal(commands[0][1],'default');
 for(const value of Object.values(commands[0][2]))assert.equal(value,'denied');
 const update=commands.find(command=>command[0]==='consent'&&command[1]==='update')[2];
 assert.deepEqual(copy(update),{analytics_storage:'granted',ad_storage:'granted',ad_user_data:'granted',ad_personalization:'denied'});
 const configs=commands.filter(command=>command[0]==='config');assert.equal(configs.length,1);assert.equal(configs[0][1],'G-BTK39BBNRE');
 const config=configs[0][2];assert.equal(config.send_page_view,false);assert.equal(config.page_location,'https://www.mft.care/?gclid=synthetic-click');
 assert.equal(config.page_title,'M.F.T. Public Website');assert.equal(config.page_referrer,'');assert.equal(config.cookie_domain,'none');assert.equal(config.cookie_expires,1800);assert.equal(config.cookie_update,false);
 for(const key of ['allow_google_signals','allow_ad_personalization_signals','allow_enhanced_conversions'])assert.equal(config[key],false);
 assert.equal(events(x).length,0);assert.doesNotMatch(JSON.stringify(commands),/"(?:campaign_source|campaign_medium|campaign_id|user_id|user_data)"|private\.example/);
 x.c.MFTGoogleMeasurement.grant();x.rerunGoogle();assert.equal(x.loaders.length,1);assert.equal(x.commands().filter(command=>command[0]==='config').length,1);
 const linker=commands.find(command=>command[0]==='set'&&command[1]==='linker')[2];assert.deepEqual(copy(linker),{domains:[],accept_incoming:false,decorate_forms:false});
});
test('handoffs are not queued before consent or before vendor readiness',()=>{
 const x=fixture();assert.equal(x.c.MFTGoogleMeasurement.handoff(),false);
 x.c.MFTGoogleMeasurement.grant();assert.equal(x.c.MFTGoogleMeasurement.handoff(),false);
 x.load();assert.equal(events(x).length,0);assert.equal(x.c.MFTGoogleMeasurement.handoff(),true);
 assert.equal(events(x).length,1);assert.equal(events(x)[0][1],'simplepractice_exit');
 assert.deepEqual(Object.keys(events(x)[0][2]).sort(),['send_to','page_location','page_title','page_referrer'].sort());
});
test('private, malformed, duplicate and unsupported query or fragment context blocks the loader',()=>{
 for(const options of [{search:'?email=synthetic%40example.invalid'},{search:'?gclid=one&gclid=two'},
  {search:'?gclid=patient%20name'},{search:'?utm_campaign=therapy-client'},
  {search:'?utm_campaign_id=99999999999'},{search:'?_gl=synthetic-linker'},
  {search:'?gclid=synthetic-click&session_id=private'},{hash:'#private-contact'}]){
  const x=fixture(options);assert.equal(x.queryReads(),0);assert.equal(x.c.MFTGoogleMeasurement.grant(),false);
  assert.equal(x.c.MFTGoogleMeasurement.status(),'unavailable');assert.equal(x.loaders.length,0);assert.equal(x.c.dataLayer,undefined);assert.deepEqual(x.c.sessionStorage.all(),{});
 }
});
test('a query change after permission halts before lifecycle collection or observer delivery',()=>{
 for(const search of ['?email=private-query-canary','?utm_content=private-query-canary','?_gl=private-query-canary','?gclid=one&gclid=two']){
  for(const trigger of ['visibilitychange','pagehide','observer']){
   const x=fixture({search:'?gclid=synthetic-click'});x.c.MFTGoogleMeasurement.grant();x.load();
   x.c.localStorage.setItem('_gcl_ls','synthetic-vendor-backup');x.jar.set('mftga_ga','synthetic-cookie');
   x.c.location.search=search;
   if(trigger==='observer')x.mutate();
   else x.fire(trigger==='visibilitychange'?'document':'window',trigger);
   assert.equal(x.c['ga-disable-G-BTK39BBNRE'],true);assert.equal(x.loaders[0].removed,true);
   assert.equal(x.c.sessionStorage.getItem(SOURCE),null);assert.equal(x.c.localStorage.getItem('_gcl_ls'),null);assert.equal(x.document.cookie,'');
   assert.equal(x.c.MFTGoogleMeasurement.handoff(),false);assert.deepEqual(events(x),[]);assert.equal(x.reloads(),0);
   x.c.location.search='?gclid=synthetic-click';assert.equal(x.c.MFTGoogleMeasurement.handoff(),false,'restoring a permitted query cannot revive the halted vendor');
  }
 }
});
test('permitted query enforcement is read-only and preserves the original context deadline',()=>{
 const x=fixture({search:'?gclid=synthetic-click&utm_source=google&utm_medium=cpc'});x.c.MFTGoogleMeasurement.grant();x.load();
 x.c.localStorage.setItem('_gcl_ls','synthetic-vendor-backup');x.jar.set('mftga_ga','synthetic-cookie');
 const consent=x.c.localStorage.getItem(CONSENT),source=x.c.sessionStorage.getItem(SOURCE);
 const localWrites=x.c.localStorage.writes.length,sourceWrites=x.c.sessionStorage.writes.length,cookieWrites=x.cookieWrites.length;
 x.clock.now+=5000;x.mutate();x.fire('document','visibilitychange');x.fire('window','pagehide');
 assert.equal(x.c.MFTGoogleMeasurement.status(),'granted');assert.equal(x.c['ga-disable-G-BTK39BBNRE'],false);
 assert.equal(x.c.localStorage.getItem(CONSENT),consent);assert.equal(x.c.sessionStorage.getItem(SOURCE),source);
 assert.equal(x.c.localStorage.getItem('_gcl_ls'),'synthetic-vendor-backup');assert.equal(x.jar.get('mftga_ga'),'synthetic-cookie');
 assert.equal(x.c.localStorage.writes.length,localWrites);assert.equal(x.c.sessionStorage.writes.length,sourceWrites);assert.equal(x.cookieWrites.length,cookieWrites);
});
test('unknown forms block eligibility but the unchanged functional scheduling acknowledgments do not',()=>{
 const unapproved={closest:()=>null,matches:()=>false};const x=fixture({controls:[unapproved]});
 x.c.MFTGoogleMeasurement.grant();assert.equal(x.loaders.length,0);assert.equal(x.c.MFTGoogleMeasurement.status(),'unavailable');
 const known={closest:()=>({}),matches:()=>true};const allowed=fixture({controls:[known]});allowed.c.MFTGoogleMeasurement.grant();assert.equal(allowed.loaders.length,1);
});
test('existing senders fail closed instead of installing a competing Google runtime',()=>{
 const x=fixture({otherSender:true});x.c.MFTGoogleMeasurement.grant();assert.equal(x.loaders.length,0);assert.equal(x.c.MFTGoogleMeasurement.status(),'unavailable');assert.equal(x.c['ga-disable-G-BTK39BBNRE'],true);
});
test('only real permitted native identifier fields are retained; source survives approved navigation without renewing expiry',()=>{
 const clock={now:1800000000000},first=fixture({clock,search:'?gclid=synthetic-one&gbraid=synthetic-two&wbraid=synthetic-three'});
 first.c.MFTGoogleMeasurement.grant();const initial=JSON.parse(first.c.sessionStorage.getItem(SOURCE));
 assert.deepEqual(initial,{review:REVIEW,expiresAt:clock.now+LIFETIME,clickIds:{gclid:'synthetic-one',gbraid:'synthetic-two',wbraid:'synthetic-three'}});
 clock.now+=600000;const next=fixture({clock,route:'/about/',local:first.c.localStorage.all(),session:first.c.sessionStorage.all(),cookies:{mftga_ga:'synthetic-cookie'}});
 assert.equal(next.c.MFTGoogleMeasurement.status(),'granted');assert.equal(next.loaders.length,1);
 const restored=JSON.parse(next.c.sessionStorage.getItem(SOURCE));assert.deepEqual(restored,initial);
 assert.equal(next.jar.get('mftga_ga'),'synthetic-cookie');
 const config=next.commands().find(command=>command[0]==='config')[2];assert.equal(config.cookie_expires,1200);
 assert.equal(config.page_location,'https://www.mft.care/about/?gclid=synthetic-one&gbraid=synthetic-two&wbraid=synthetic-three');
});
test('noneligible navigation retains only prior consented source with its original deadline and loads no Google',()=>{
 const clock={now:1800000000000},first=fixture({clock,search:'?gclid=synthetic-one'});first.c.MFTGoogleMeasurement.grant();
 const retained=first.c.sessionStorage.getItem(SOURCE),expiry=JSON.parse(retained).expiresAt;
 clock.now+=300000;
 const excluded=fixture({clock,route:'/services/',local:first.c.localStorage.all(),session:first.c.sessionStorage.all(),cookies:{mftga_ga:'synthetic',_gcl_aw:'synthetic'}});
 excluded.addOps();assert.equal(excluded.c.MFTGoogleMeasurement,undefined);assert.equal(excluded.c.dataLayer,undefined);assert.equal(excluded.loaders.length,0);
 assert.equal(excluded.queryReads(),0);assert.equal(excluded.c.sessionStorage.getItem(SOURCE),retained);assert.equal(excluded.document.cookie,'');
 assert.equal(JSON.parse(excluded.c.localStorage.getItem(CONSENT)).expiresAt,expiry);
 clock.now+=300000;
 const returned=fixture({clock,local:excluded.c.localStorage.all(),session:excluded.c.sessionStorage.all()});
 assert.equal(returned.loaders.length,1);assert.equal(returned.c.sessionStorage.getItem(SOURCE),retained);
 assert.equal(returned.commands().find(command=>command[0]==='config')[2].page_location,'https://www.mft.care/?gclid=synthetic-one');
 const stayed=fixture({clock,route:'/services/',local:first.c.localStorage.all(),session:first.c.sessionStorage.all()});stayed.addOps();stayed.advance(expiry-clock.now);
 assert.equal(stayed.c.sessionStorage.getItem(SOURCE),null);assert.equal(stayed.loaders.length,0);
});
test('noneligible pages discard invalid context and honor Google withdrawal and privacy signals independently',()=>{
 const first=fixture({search:'?gclid=synthetic-one'});first.c.MFTGoogleMeasurement.grant();
 const base={route:'/services/',local:first.c.localStorage.all(),session:first.c.sessionStorage.all()};
 for(const mutate of [context=>({...context,private:'no'}),context=>({...context,expiresAt:context.expiresAt+1}),context=>({...context,clickIds:{email:'private@example.invalid'}})]){
  const context=mutate(JSON.parse(base.session[SOURCE]));const x=fixture({...base,session:{[SOURCE]:JSON.stringify(context)}});x.addOps();
  assert.equal(x.c.sessionStorage.getItem(SOURCE),null);assert.equal(x.loaders.length,0);assert.equal(x.queryReads(),0);
 }
 const withdraw=fixture(base);withdraw.addOps();withdraw.c.MFTAdvertisingConsent.deny();assert.equal(withdraw.c.sessionStorage.getItem(SOURCE),null);
 assert.deepEqual(JSON.parse(withdraw.c.localStorage.getItem(CONSENT)),{choice:'denied'});
 const crossTab=fixture(base);crossTab.addOps();crossTab.c.localStorage.setItem(CONSENT,JSON.stringify({choice:'denied'}));crossTab.fire('window','storage',{key:CONSENT,newValue:crossTab.c.localStorage.getItem(CONSENT)});
 assert.equal(crossTab.c.sessionStorage.getItem(SOURCE),null);
 for(const signal of [{gpc:true},{dnt:'1'}]){
  const x=fixture({...base,...signal});x.addOps();assert.equal(x.c.sessionStorage.getItem(SOURCE),null);
  assert.deepEqual(JSON.parse(x.c.localStorage.getItem(CONSENT)),{choice:'denied'});assert.equal(x.queryReads(),0);
 }
});
test('a new explicit source without a click ID does not invent one from a previous arrival',()=>{
 const first=fixture({search:'?gclid=synthetic-one'});first.c.MFTGoogleMeasurement.grant();
 const next=fixture({route:'/about/',local:first.c.localStorage.all(),session:first.c.sessionStorage.all(),search:'?utm_source=google&utm_medium=cpc&utm_campaign_id=24530528782'});
 assert.deepEqual(JSON.parse(next.c.sessionStorage.getItem(SOURCE)).clickIds,{});
 assert.equal(next.commands().find(command=>command[0]==='config')[2].page_location,'https://www.mft.care/about/');
});
test('expiry clears controlled context and cookies without navigating and a later document cannot recapture the old URL',()=>{
 const x=fixture({search:'?gclid=synthetic-click'});x.c.MFTGoogleMeasurement.grant();x.load();
 x.jar.set('mftga_ga','synthetic');x.jar.set('_gcl_aw','synthetic');x.jar.set('functional','keep');x.advance(LIFETIME);
 assert.equal(x.c.MFTGoogleMeasurement.status(),'unavailable');assert.equal(x.c.MFTGoogleMeasurement.handoff(),false);assert.equal(x.reloads(),0);
 assert.deepEqual(x.c.sessionStorage.all(),{});assert.equal(x.document.cookie,'functional=keep');
 const reload=fixture({clock:x.clock,local:x.c.localStorage.all(),search:'?gclid=synthetic-click'});
 assert.equal(reload.loaders.length,0);assert.equal(reload.queryReads(),0);assert.equal(reload.c.MFTGoogleMeasurement.status(),'unset');
});
test('the exact native Google backup is cleared at refusal, expiry and the next inactive-runtime load without touching functional storage',()=>{
 const backup=JSON.stringify({schema:'gcl',version:1,gclid:{value:{value:'synthetic-click'},expires:1800001800000}});
 for(const choice of [undefined,JSON.stringify({choice:'denied'}),JSON.stringify({choice:'granted',review:REVIEW,expiresAt:1799999999999})]){
  const x=fixture({local:{_gcl_ls:backup,'functional.preference':'keep',...(choice?{[CONSENT]:choice}:{})}});
  assert.equal(x.c.localStorage.getItem('_gcl_ls'),null);assert.equal(x.c.localStorage.getItem('functional.preference'),'keep');
  assert.equal(x.loaders.length,0);assert.equal(x.queryReads(),0);
 }
 for(const reason of ['withdrawal','expiry','loader-error','title-change','legacy-refusal']){
  const x=fixture({local:{'functional.preference':'keep'}});x.c.MFTGoogleMeasurement.grant();x.load();x.c.localStorage.setItem('_gcl_ls',backup);
  if(reason==='withdrawal')x.c.MFTGoogleMeasurement.deny();
  if(reason==='expiry')x.advance(LIFETIME);
  if(reason==='loader-error')x.fail();
  if(reason==='title-change'){x.document.title='Private title';x.mutate();}
  if(reason==='legacy-refusal')x.fire('window','storage',{key:'mft.analytics.consent.v4',newValue:'denied'});
  assert.equal(x.c.localStorage.getItem('_gcl_ls'),null,reason);assert.equal(x.c.localStorage.getItem('functional.preference'),'keep',reason);
  assert.equal(x.c.MFTGoogleMeasurement.handoff(),false);assert.equal(x.reloads(),0);
 }
});
test('a stale document expiry stops its own sender without deleting a newer independent grant, source or cookies',()=>{
 for(const expiry of ['timer','handoff','pageshow']){
  const x=fixture({search:'?gclid=old-click'});x.c.MFTGoogleMeasurement.grant();x.load();
  const original=JSON.parse(x.c.sessionStorage.getItem(SOURCE));
  const newerPermission={choice:'granted',review:expiry==='pageshow'?'b'.repeat(64):REVIEW,expiresAt:original.expiresAt+600000};
  const newerSource={review:newerPermission.review,expiresAt:newerPermission.expiresAt,clickIds:{gclid:'newer-click'}};
  x.c.localStorage.setItem(CONSENT,JSON.stringify(newerPermission));x.c.sessionStorage.setItem(SOURCE,JSON.stringify(newerSource));
  x.c.localStorage.setItem('_gcl_ls','synthetic-newer-vendor-backup');
  x.jar.set('mftga_ga','newer-cookie');x.jar.set('_gcl_au','newer-ad-cookie');x.jar.set('functional','keep');
  if(expiry==='timer')x.advance(LIFETIME);
  else{x.clock.now+=LIFETIME;if(expiry==='handoff')assert.equal(x.c.MFTGoogleMeasurement.handoff(),false);else x.fire('window','pageshow');}
  assert.equal(x.c['ga-disable-G-BTK39BBNRE'],true);assert.equal(x.c.MFTGoogleMeasurement.handoff(),false);
  assert.deepEqual(JSON.parse(x.c.localStorage.getItem(CONSENT)),newerPermission);
  assert.deepEqual(JSON.parse(x.c.sessionStorage.getItem(SOURCE)),newerSource);
  assert.equal(x.c.localStorage.getItem('_gcl_ls'),'synthetic-newer-vendor-backup');
  assert.equal(x.jar.get('mftga_ga'),'newer-cookie');assert.equal(x.jar.get('_gcl_au'),'newer-ad-cookie');assert.equal(x.jar.get('functional'),'keep');
 }
});
test('a newer review storage event stops only the older document through later lifecycle checks and expiry',()=>{
 const x=fixture({search:'?gclid=old-click'});x.c.MFTGoogleMeasurement.grant();x.load();
 const original=JSON.parse(x.c.localStorage.getItem(CONSENT));x.clock.now+=600000;
 const newerPermission={choice:'granted',review:'b'.repeat(64),expiresAt:original.expiresAt+600000};
 const newerSource={review:newerPermission.review,expiresAt:newerPermission.expiresAt,clickIds:{gclid:'newer-click'}};
 x.c.localStorage.setItem(CONSENT,JSON.stringify(newerPermission));x.c.sessionStorage.setItem(SOURCE,JSON.stringify(newerSource));
 x.c.localStorage.setItem('_gcl_ls','newer-vendor-backup');x.jar.set('mftga_ga','newer-cookie');x.jar.set('functional','keep');
 x.fire('window','storage',{key:CONSENT,newValue:JSON.stringify(newerPermission)});
 const preserved=()=>{
  assert.deepEqual(JSON.parse(x.c.localStorage.getItem(CONSENT)),newerPermission);
  assert.deepEqual(JSON.parse(x.c.sessionStorage.getItem(SOURCE)),newerSource);
  assert.equal(x.c.localStorage.getItem('_gcl_ls'),'newer-vendor-backup');assert.equal(x.jar.get('mftga_ga'),'newer-cookie');
  assert.equal(x.c['ga-disable-G-BTK39BBNRE'],true);assert.equal(x.c.MFTGoogleMeasurement.requiresReload(),true);
  assert.equal(x.c.MFTGoogleMeasurement.handoff(),false);assert.equal(x.reloads(),0);assert.equal(x.loaders.length,1);assert.equal(stopPolicies(x).length,1);
 };
 preserved();
 for(const [target,name]of [['window','pagehide'],['window','pageshow'],['document','visibilitychange']]){x.fire(target,name);preserved();}
 assert.equal(x.c.MFTGoogleMeasurement.enforceBoundary(),false);preserved();
 x.advance(original.expiresAt-x.clock.now);preserved();
 x.fire('window','pageshow');x.c.MFTGoogleMeasurement.enforceBoundary();preserved();
 x.c.MFTGoogleMeasurement.deny();
 assert.deepEqual(JSON.parse(x.c.localStorage.getItem(CONSENT)),{choice:'denied'});
 assert.equal(x.c.sessionStorage.getItem(SOURCE),null);assert.equal(x.c.localStorage.getItem('_gcl_ls'),null);assert.equal(x.jar.has('mftga_ga'),false);
 assert.equal(x.jar.get('functional'),'keep');assert.equal(x.reloads(),0);assert.equal(x.c.MFTGoogleMeasurement.status(),'denied');
});
test('expiry removes its own old source but preserves cookies used by a newer other-tab grant; explicit withdrawal clears both',()=>{
 const x=fixture({search:'?gclid=old-click'});x.c.MFTGoogleMeasurement.grant();x.load();
 x.c.localStorage.setItem(CONSENT,grantRecord(x.clock.now+600000));x.jar.set('mftga_ga','newer-cookie');
 x.advance(LIFETIME);assert.equal(x.c.sessionStorage.getItem(SOURCE),null);assert.equal(x.jar.get('mftga_ga'),'newer-cookie');
 const newerSource={review:REVIEW,expiresAt:x.clock.now+600000,clickIds:{gclid:'newer-click'}};
 x.c.sessionStorage.setItem(SOURCE,JSON.stringify(newerSource));x.c.localStorage.setItem('_gcl_ls','synthetic-newer-backup');x.c.MFTGoogleMeasurement.deny();
 assert.equal(x.c.sessionStorage.getItem(SOURCE),null);assert.equal(x.jar.has('mftga_ga'),false);
 assert.equal(x.c.localStorage.getItem('_gcl_ls'),null);
 assert.deepEqual(JSON.parse(x.c.localStorage.getItem(CONSENT)),{choice:'denied'});
});
test('withdrawal immediately stops future dispatch and clears website state without navigating',()=>{
 const x=fixture({search:'?gclid=synthetic-click'});x.c.MFTGoogleMeasurement.grant();x.load();
 x.jar.set('mftga_ga','synthetic');x.jar.set('_gcl_au','synthetic');
 x.c.MFTGoogleMeasurement.deny();x.c.MFTGoogleMeasurement.deny();
 assert.equal(x.c.MFTGoogleMeasurement.status(),'denied');assert.equal(x.c.MFTGoogleMeasurement.handoff(),false);
 assert.equal(x.reloads(),0);assert.equal(x.c['ga-disable-G-BTK39BBNRE'],true);assert.equal(x.loaders[0].removed,true);
 assert.deepEqual(events(x),[]);assert.deepEqual(x.c.sessionStorage.all(),{});assert.equal(x.document.cookie,'');
 assert.deepEqual(JSON.parse(x.c.localStorage.getItem(CONSENT)),{choice:'denied'});assert.equal(x.c.MFTGoogleMeasurement.requiresReload(),true);
});
test('stopping before any vendor request leaves the document usable for an explicit first grant',()=>{
 const x=fixture({search:'?gclid=synthetic-click'});
 x.c.MFTGoogleMeasurement.deny();x.fire('window','pagehide');
 assert.equal(stopPolicies(x).length,0);assert.equal(x.c.MFTGoogleMeasurement.requiresReload(),false);assert.equal(x.queryReads(),0);
 assert.equal(x.c.MFTGoogleMeasurement.grant(),true);assert.equal(x.loaders.length,1);assert.equal(x.reloads(),0);
 assert.equal(x.c['ga-disable-G-BTK39BBNRE'],false);x.load();assert.equal(x.c.MFTGoogleMeasurement.handoff(),true);
});
test('every post-request stop installs one additional native network policy before later lifecycle listeners',()=>{
 for(const loaded of [false,true]){
  for(const reason of ['withdrawal','expiry','loader-error','gpc','cross-tab','title','query','form']){
   const controls=[],x=fixture({controls});x.c.MFTGoogleMeasurement.grant();if(loaded)x.load();
   let laterListenerSawPolicy=false;
   x.c.addEventListener('pagehide',()=>{laterListenerSawPolicy=stopPolicies(x).length===1;});
   if(reason==='withdrawal')x.c.MFTGoogleMeasurement.deny();
   if(reason==='expiry')x.advance(LIFETIME);
   if(reason==='loader-error')x.fail();
   if(reason==='gpc')x.c.navigator.globalPrivacyControl=true;
   if(reason==='cross-tab'){x.c.localStorage.setItem(CONSENT,JSON.stringify({choice:'denied'}));x.fire('window','storage',{key:CONSENT,newValue:JSON.stringify({choice:'denied'})});}
   if(reason==='title')x.document.title='Private title';
   if(reason==='query')x.c.location.search='?email=private-canary';
   if(reason==='form')controls.push({closest:()=>null,matches:()=>false});
   x.fire('window','pagehide');x.fire('document','visibilitychange');x.c.MFTGoogleMeasurement.enforceBoundary();
   assert.equal(laterListenerSawPolicy,true,reason+' / loaded='+loaded);
   const policies=stopPolicies(x);assert.equal(policies.length,1,reason+' / loaded='+loaded);
   assert.equal(policies[0].httpEquiv,'Content-Security-Policy');assert.equal(policies[0].removed,undefined);
   const directives=Object.fromEntries(policies[0].content.split(';').map(part=>part.trim().split(/\s+/)).map(([name,...sources])=>[name,sources]));
   assert.deepEqual(directives['default-src'],["'self'"]);assert.deepEqual(directives['worker-src'],["'none'"]);
   assert.ok(directives['connect-src'].includes('https://ops.mft.care'));
   assert.ok(directives['script-src'].includes('https://widget-cdn.simplepractice.com'));
   assert.ok(directives['frame-src'].includes('https://marriagefamilytherapy.clientsecure.me'));
   assert.ok(directives['img-src'].includes('https://images.squarespace-cdn.com'));
   assert.ok(directives['form-action'].includes('https://marriagefamilytherapy.clientsecure.me'));
   assert.doesNotMatch(policies[0].content,/google|doubleclick|https:\s|\*/);
   assert.equal(x.c['ga-disable-G-BTK39BBNRE'],true);assert.equal(x.c.MFTGoogleMeasurement.handoff(),false);assert.equal(x.reloads(),0);
   // A pending loader's late load callback must not undo the policy or queue.
   x.load();assert.equal(x.c.MFTGoogleMeasurement.handoff(),false);assert.equal(x.loaders.length,1);assert.equal(stopPolicies(x).length,1);
  }
 }
});
test('a later explicit grant persists a fresh deadline and reloads once without reviving the clamped document',()=>{
 for(const stop of ['withdrawal','expiry','loader-error','title']){
  const x=fixture({search:'?gclid=synthetic-click'});x.c.MFTGoogleMeasurement.grant();x.load();
  const original=JSON.parse(x.c.localStorage.getItem(CONSENT));
  if(stop==='withdrawal')x.c.MFTGoogleMeasurement.deny();
  if(stop==='expiry')x.advance(LIFETIME);
  if(stop==='loader-error')x.fail();
  if(stop==='title'){x.document.title='Private title';x.mutate();x.document.title=TITLES['/'];}
  x.clock.now+=5000;
  assert.equal(x.c.MFTGoogleMeasurement.available(),true);assert.equal(x.c.MFTGoogleMeasurement.requiresReload(),true);
  assert.equal(x.c.MFTGoogleMeasurement.grant(),true);
  const fresh=JSON.parse(x.c.localStorage.getItem(CONSENT));
  assert.equal(fresh.choice,'granted');assert.equal(fresh.review,REVIEW);assert.equal(fresh.expiresAt,x.clock.now+LIFETIME);assert.ok(fresh.expiresAt>original.expiresAt);
  assert.equal(x.reloads(),1);assert.equal(x.c['ga-disable-G-BTK39BBNRE'],true);assert.equal(x.c.MFTGoogleMeasurement.status(),'unavailable');
  assert.equal(x.c.MFTGoogleMeasurement.handoff(),false);assert.deepEqual(x.commands(),[]);assert.equal(x.loaders.length,1);assert.equal(stopPolicies(x).length,1);
  x.clock.now+=1000;assert.equal(x.c.MFTGoogleMeasurement.grant(),false);assert.equal(x.reloads(),1);assert.deepEqual(JSON.parse(x.c.localStorage.getItem(CONSENT)),fresh);
  const next=fixture({clock:x.clock,local:x.c.localStorage.all(),search:'?gclid=synthetic-click'});
  assert.equal(next.loaders.length,1);assert.equal(stopPolicies(next).length,0);assert.equal(next.c.MFTGoogleMeasurement.requiresReload(),false);
  assert.equal(next.c.MFTGoogleMeasurement.status(),'granted');assert.equal(next.c.MFTGoogleMeasurement.handoff(),false,'a fresh document never replays the old handoff');
  next.load();assert.equal(next.c.MFTGoogleMeasurement.handoff(),true);
 }
});
test('a clamped document rejects unsafe or unpersistable regrants without reloading or extending permission',()=>{
 for(const unsafe of ['route','origin','title','query','hash','form','gpc','dnt']){
  const controls=[],x=fixture({controls});x.c.MFTGoogleMeasurement.grant();x.load();x.c.MFTGoogleMeasurement.deny();x.clock.now+=5000;
  if(unsafe==='route')x.c.location.pathname='/gary-ashley/';
  if(unsafe==='origin')x.c.location.origin='https://preview.example.invalid';
  if(unsafe==='title')x.document.title='Private title';
  if(unsafe==='query')x.c.location.search='?email=private-canary';
  if(unsafe==='hash')x.c.location.hash='#private-canary';
  if(unsafe==='form')controls.push({closest:()=>null,matches:()=>false});
  if(unsafe==='gpc')x.c.navigator.globalPrivacyControl=true;
  if(unsafe==='dnt')x.c.navigator.doNotTrack='1';
  assert.equal(x.c.MFTGoogleMeasurement.grant(),false,unsafe);assert.equal(x.reloads(),0);assert.equal(x.loaders.length,1);assert.equal(stopPolicies(x).length,1);
  assert.deepEqual(JSON.parse(x.c.localStorage.getItem(CONSENT)),{choice:'denied'},unsafe);
  assert.equal(x.c.MFTGoogleMeasurement.handoff(),false);assert.equal(x.c['ga-disable-G-BTK39BBNRE'],true);
 }
 const blocked=fixture({blockedStorage:true});blocked.c.MFTGoogleMeasurement.grant();blocked.load();blocked.c.MFTGoogleMeasurement.deny();
 assert.equal(blocked.c.MFTGoogleMeasurement.grant(),false);assert.equal(blocked.reloads(),0);assert.equal(blocked.c.MFTGoogleMeasurement.status(),'denied');assert.equal(stopPolicies(blocked).length,1);
});
test('GPC and DNT override stored permission and later changes revoke an already started vendor',()=>{
 for(const options of [{gpc:true},{dnt:'1'}]){
  const x=fixture({...options,local:{[CONSENT]:grantRecord(1800000000000)},search:'?gclid=synthetic-click'});
  assert.equal(x.loaders.length,0);assert.equal(x.queryReads(),0);assert.equal(x.c.MFTGoogleMeasurement.grant(),false);assert.equal(x.c.MFTGoogleMeasurement.status(),'denied');
 }
 const x=fixture();x.c.MFTGoogleMeasurement.grant();x.load();x.c.navigator.globalPrivacyControl=true;
 x.c.MFTGoogleMeasurement.enforceBoundary();assert.equal(x.reloads(),0);assert.equal(x.c.MFTGoogleMeasurement.handoff(),false);assert.deepEqual(x.c.sessionStorage.all(),{});
});
test('cross-tab withdrawal and storage clear revoke; another-tab grant never replays a handoff',()=>{
 const x=fixture();x.c.MFTGoogleMeasurement.handoff();x.c.localStorage.setItem(CONSENT,grantRecord(x.clock.now));
 x.fire('window','storage',{key:CONSENT,newValue:x.c.localStorage.getItem(CONSENT)});assert.equal(x.loaders.length,0);
 x.c.MFTGoogleMeasurement.grant();x.load();assert.equal(events(x).length,0);
 x.c.localStorage.setItem(CONSENT,JSON.stringify({choice:'denied'}));x.fire('window','storage',{key:CONSENT,newValue:x.c.localStorage.getItem(CONSENT)});
 assert.equal(x.c.MFTGoogleMeasurement.status(),'denied');assert.equal(x.reloads(),0);
 const clear=fixture();clear.c.MFTGoogleMeasurement.grant();clear.load();clear.fire('window','storage',{key:null,newValue:null});
 assert.equal(clear.c.MFTGoogleMeasurement.status(),'denied');assert.equal(clear.reloads(),0);
});
test('new refusals in prior Google-capable tabs revoke the current Google purpose',()=>{
 for(const key of ['mft.analytics.consent.v4','mft.analytics.consent.v3','mft.analytics.consent.v2']){
  const x=fixture({search:'?gclid=synthetic-click'});x.addOps();x.c.MFTGoogleMeasurement.grant();x.load();
  x.c.localStorage.setItem(key,'denied');x.fire('window','storage',{key,newValue:'denied'});
  assert.equal(x.c.MFTGoogleMeasurement.status(),'denied');assert.equal(x.c.MFTGoogleMeasurement.handoff(),false);
  assert.deepEqual(JSON.parse(x.c.localStorage.getItem(CONSENT)),{choice:'denied'});assert.equal(x.c.sessionStorage.getItem(SOURCE),null);
 }
});
test('the auto-written advertising-v1 default and an analytics-only v5 storage event do not revoke a distinct current Google grant',()=>{
 for(const key of ['mft.advertising.consent.v1',OPS_CONSENT]){
  const x=fixture();x.addOps();x.c.MFTGoogleMeasurement.grant();x.load();
  x.c.localStorage.setItem(key,'denied');x.fire('window','storage',{key,newValue:'denied'});
  assert.equal(x.c.MFTGoogleMeasurement.status(),'granted');assert.equal(x.c.MFTGoogleMeasurement.handoff(),true);
 }
});
test('first-party permission never grants Google, and Google permission need not create an Ops event',()=>{
 const x=fixture({search:'?gclid=synthetic-click'});x.addOps();x.c.MFTAnalyticsConsent.grant();
 assert.equal(x.c.MFTGoogleMeasurement.status(),'unset');assert.equal(x.loaders.length,0);assert.equal(x.c.localStorage.getItem(CONSENT),null);
 x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body');assert.equal(x.ops.length,1);assert.equal(events(x).length,0);
 const separate=fixture();separate.addOps();separate.c.MFTGoogleMeasurement.grant();separate.load();
 assert.equal(separate.c.MFTAnalyticsConsent.status(),'unset');separate.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body',undefined,{googleGenericHandoff:true});
 assert.equal(separate.ops.length,0);assert.equal(events(separate).length,1);
});
test('integration sends one qualified event with no Ops UUID, page code, placement, clinician or destination',()=>{
 const x=fixture({local:{[OPS_CONSENT]:'granted'}});x.addOps();x.c.MFTGoogleMeasurement.grant();x.load();
 x.c.MFTSchedulingMeasurement.track(['consultation_click','clinician_schedule_click','appointment_request_click'],'body');
 assert.equal(x.ops.length,0);assert.equal(events(x).length,0);
 x.c.MFTSchedulingMeasurement.track(['simplepractice_exit','simplepractice_exit','appointment_request_click'],'dialog',undefined,{googleGenericHandoff:true});
 assert.equal(x.ops.length,1);assert.equal(events(x).length,1);
 const raw=JSON.stringify(x.commands());assert.doesNotMatch(raw,/a0000000|0123456789abcdef|pageCode|eventId|placement|dialog|clientsecure|clinician|campaign_/);
 assert.equal(x.ops[0].body.consentVersion,'mft.analytics.consent.v4');
});
test('the bridge requires the generic eligibility boolean and rejects clinician diagnostics without changing Ops',()=>{
 const x=fixture({local:{[OPS_CONSENT]:'granted'}});x.addOps();x.c.MFTGoogleMeasurement.grant();x.load();let completed=0;
 for(const [names,eligibility]of [
  [['simplepractice_exit'],undefined],
  [['simplepractice_exit'],{googleGenericHandoff:false}],
  [['simplepractice_exit'],{googleGenericHandoff:'true'}],
  [['simplepractice_exit','clinician_schedule_click'],{googleGenericHandoff:true}]
 ])x.c.MFTSchedulingMeasurement.track(names,'dialog',()=>completed++,eligibility);
 assert.equal(x.ops.length,4);assert.equal(completed,4);assert.equal(events(x).length,0);
 x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'dialog',()=>completed++,{googleGenericHandoff:true});
 assert.equal(x.ops.length,5);assert.equal(completed,5);assert.equal(events(x).length,1);
});
test('native source IDs never enter the independent first-party envelope and Google failure does not suppress Ops',()=>{
 const x=fixture({search:'?gclid=synthetic-click&utm_source=google&utm_medium=cpc&utm_campaign_id=24530528782',local:{[OPS_CONSENT]:'granted'}});x.addOps();
 x.c.MFTGoogleMeasurement.grant();x.fail();x.c.MFTSchedulingMeasurement.track(['simplepractice_exit'],'body');
 assert.equal(x.ops.length,1);assert.doesNotMatch(JSON.stringify(x.ops[0].body),/synthetic-click|gclid|gbraid|wbraid/);assert.equal(x.ops[0].body.campaignId,'24530528782');
});
test('blocked storage preserves explicit in-memory choice without a pre-consent fallback request',()=>{
 const x=fixture({blockedStorage:true});assert.equal(x.loaders.length,0);x.c.MFTGoogleMeasurement.grant();x.load();
 assert.equal(x.c.MFTGoogleMeasurement.handoff(),true);x.c.MFTGoogleMeasurement.deny();assert.equal(x.c.MFTGoogleMeasurement.handoff(),false);assert.equal(x.reloads(),0);
});
test('the existing notice offers distinct Google actions only for an approved available runtime',()=>{
 const x=fixture({local:{[OPS_CONSENT]:'granted'}});x.addOps();
 const banner=x.elements.find(element=>element.id==='mft-analytics-consent');assert.ok(banner);
 assert.match(banner.innerHTML,/data-choice="grant-ad"/);assert.match(banner.innerHTML,/data-choice="deny-ad"/);
 assert.match(banner.innerHTML,/Google has separate retention rules/);assert.doesNotMatch(banner.innerHTML,/Google[^.]*30 days/);
 assert.match(banner.innerHTML,/public page address and title, visit activity/);assert.match(banner.innerHTML,/IP address/);assert.match(banner.innerHTML,/existing Google cookies/);
 for(const fn of banner.handlers.click)fn({target:{dataset:{choice:'dismiss'}}});
 assert.equal(x.c.MFTGoogleMeasurement.status(),'unset');assert.equal(x.loaders.length,0);assert.equal(x.c.MFTAnalyticsConsent.status(),'granted');
});
test('a halted vendor stays stopped while the notice offers only a fresh explicit grant with reload',()=>{
 for(const stop of ['expiry','withdrawal','error']){
  const x=fixture();x.addOps();const original=x.elements.find(element=>element.id==='mft-analytics-consent');
  for(const fn of original.handlers.click)fn({target:{dataset:{choice:'dismiss'}}});
  x.c.MFTGoogleMeasurement.grant();x.load();
  if(stop==='expiry')x.advance(LIFETIME);
  if(stop==='withdrawal')x.c.MFTGoogleMeasurement.deny();
  if(stop==='error')x.fail();
  assert.equal(x.c.MFTGoogleMeasurement.available(),true);assert.equal(x.c.MFTGoogleMeasurement.requiresReload(),true);assert.equal(x.c.MFTGoogleMeasurement.handoff(),false);
  assert.equal(x.c.MFTAdvertisingConsent.status(),stop==='withdrawal'?'denied':'unavailable');
  assert.equal(x.loaders.length,1);assert.equal(x.reloads(),0);x.c.MFTAnalyticsConsent.show();
  const banner=x.elements.find(element=>element.id==='mft-analytics-consent'&&!element.removed);
  assert.match(banner.innerHTML,/data-choice="grant-ad"/);assert.match(banner.innerHTML,/Allow Google and reload/);
  assert.match(banner.innerHTML,new RegExp('data-mft-advertising-status="'+(stop==='withdrawal'?'denied':'unavailable')+'"'));
 }
});

function bookingFixture({clinician=null,consultation=false,remembered=false,existing=false,track=()=>{}}={}){
 const config=require('../content/simplepractice-booking.json'),core=require('../src/booking-core');
 const calls=[],listeners={},timers=[],storage=store(remembered?{'mft.newClientAccountAcknowledgment.v1':'acknowledged'}:{});
 function element(tag,attrs={},parent=null){
  const attributes=new Map(Object.entries(attrs)),handlers={},dataset={};
  const node={tag,dataset,handlers,parent,isConnected:true,checked:false,hidden:false,textContent:'',
   addEventListener:(name,fn)=>(handlers[name]||=[]).push(fn),getAttribute:key=>attributes.get(key)??null,hasAttribute:key=>attributes.has(key),
   setAttribute(key,value){attributes.set(key,String(value));if(key.startsWith('data-'))dataset[key.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=String(value);},
   removeAttribute(key){attributes.delete(key);if(key==='href')node.href='';},focus(){},
   closest(selector){if(selector.startsWith('a['))return tag==='a'&&attributes.has('data-mft-booking')?node:null;if(selector==='.mft-consultation-gate')return parent;return null;}};
  for(const [key,value]of attributes)node.setAttribute(key,value);return node;
 }
 const anchor=element('a',{'data-mft-booking-intent':consultation?'consultation':'appointment',...(clinician?{'data-mft-clinician':clinician}:{}),...(existing?{'data-mft-existing-client':'true'}:{})});
 anchor.href=existing?'https://marriagefamilytherapy.clientsecure.me/sign-in':config.generalUrl;
 anchor.textContent=existing?'Existing client sign-in':consultation?'Free 10-minute consultation':'Request an appointment';
 const dialog=element('dialog'),account=element('input'),notice=element('input'),go=element('a',{},dialog),cancel=element('button'),close=element('button'),form=element('form');
 const parts={'[data-mft-account-ack]':account,'[data-mft-consultation-ack]':notice,'[data-mft-account-section]':element('section'),'[data-mft-consultation-section]':element('section'),h2:element('h2'),'[data-consultation-continue]':go,form};
 dialog.querySelector=selector=>parts[selector];dialog.querySelectorAll=()=>[cancel,close];dialog.contains=node=>node===go;dialog.open=false;
 dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;for(const fn of dialog.handlers.close||[])fn();};
 const c={MFT_BOOKING_CONFIG:config,MFTBookingCore:core,location:{pathname:'/'},localStorage:storage,
  MFTSchedulingMeasurement:{track(...args){calls.push(args);return track(...args);}},HTMLDialogElement:function(){},
  document:{querySelectorAll:()=>[anchor],createElement:()=>dialog,body:{appendChild(){}},getElementById:()=>null,documentElement:{classList:{add(){},remove(){}}},
   addEventListener:(name,fn,capture)=>(listeners[name]||=[]).push({fn,capture:Boolean(capture)})},
  addEventListener(){},setTimeout:fn=>timers.push(fn)};
 c.HTMLDialogElement.prototype.showModal=function(){};c.window=c;vm.runInNewContext(fs.readFileSync(path.join(assets,'mft-booking.js'),'utf8'),c);
 function click(target,extra={}){
  const event={type:'click',target,isTrusted:true,button:0,defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};
  for(const entry of (listeners[event.type]||[]).filter(entry=>entry.capture)){entry.fn(event);if(event.stopped)return event;}
  for(const fn of target.handlers[event.type]||[]){fn(event);if(event.stopped)return event;}
  for(const entry of (listeners[event.type]||[]).filter(entry=>!entry.capture)){entry.fn(event);if(event.stopped)return event;}
  return event;
 }
 function acknowledge(){account.checked=true;notice.checked=true;for(const fn of account.handlers.change||[])fn();for(const fn of notice.handlers.change||[])fn();}
 return {anchor,dialog,account,notice,go,cancel,close,calls,storage,click,acknowledge,finish:()=>{for(const fn of timers.splice(0))fn();}};
}
test('actual booking popup emits zero before Continue and one generic eligibility assertion per dialog',()=>{
 for(const consultation of [false,true]){
  const x=bookingFixture({consultation});assert.equal(x.click(x.anchor).defaultPrevented,true);assert.equal(x.dialog.open,true);
  assert.equal(x.calls.filter(call=>call[0].includes('simplepractice_exit')).length,0);x.acknowledge();
  assert.equal(x.calls.filter(call=>call[0].includes('simplepractice_exit')).length,0);
  assert.equal(x.go.href,'https://marriagefamilytherapy.clientsecure.me/request');assert.equal(x.click(x.go).defaultPrevented,false);x.click(x.go);
  const handoffs=x.calls.filter(call=>call[0].includes('simplepractice_exit'));assert.equal(handoffs.length,1);
  assert.equal(handoffs[0][2],undefined);assert.deepEqual(copy(handoffs[0][3]),{googleGenericHandoff:true});
  x.finish();assert.equal(x.dialog.open,false);assert.equal(x.storage.getItem('mft.newClientAccountAcknowledgment.v1'),'acknowledged');
 }
});
test('actual booking never labels clinician-specific consultation or appointment destinations as Google generic',()=>{
 const clinician=require('../content/simplepractice-booking.json').clinicians[0];
 for(const consultation of [false,true]){
  const x=bookingFixture({clinician:clinician.key,consultation});x.click(x.anchor);x.acknowledge();
  assert.equal(new URL(x.go.href).searchParams.get('clinicianId'),clinician.id);x.click(x.go);
  const handoffs=x.calls.filter(call=>call[0].includes('simplepractice_exit'));assert.equal(handoffs.length,1);assert.deepEqual(copy(handoffs[0][3]),{googleGenericHandoff:false});
  if(consultation)assert.deepEqual(copy(handoffs[0][0]),['simplepractice_exit'],'the decision survives consultation diagnostic omission');
 }
});
test('cancel, dismissal and existing-client sign-in have no handoff; remembered generic acknowledgment still does',()=>{
 for(const exit of ['cancel','close']){
  const x=bookingFixture();x.click(x.anchor);x.acknowledge();x.click(x[exit]);assert.equal(x.dialog.open,false);assert.equal(x.calls.length,0);
 }
 const dismissed=bookingFixture();dismissed.click(dismissed.anchor);dismissed.dialog.close();assert.equal(dismissed.calls.length,0);
 const existing=bookingFixture({existing:true});assert.equal(existing.click(existing.anchor).defaultPrevented,false);assert.equal(existing.dialog.open,false);assert.equal(existing.calls.length,0);
 const remembered=bookingFixture({remembered:true});assert.equal(remembered.click(remembered.anchor).defaultPrevented,false);assert.equal(remembered.dialog.open,false);
 assert.equal(remembered.calls.length,1);assert.deepEqual(copy(remembered.calls[0][3]),{googleGenericHandoff:true});
});
test('Google expiry, withdrawal and loader failure preserve an open acknowledged dialog and native Continue',()=>{
 for(const failure of ['expiry','late-expiry','withdrawal','loader-error']){
  const x=fixture({local:{[OPS_CONSENT]:'granted'}});x.addOps();x.c.MFTGoogleMeasurement.grant();x.load();
  const booking=bookingFixture({track:(...args)=>x.c.MFTSchedulingMeasurement.track(...args)});
  booking.click(booking.anchor);booking.acknowledge();assert.equal(booking.dialog.open,true);
  if(failure==='expiry')x.advance(LIFETIME);
  if(failure==='late-expiry')x.clock.now+=LIFETIME;
  if(failure==='withdrawal')x.c.MFTGoogleMeasurement.deny();
  if(failure==='loader-error')x.fail();
  assert.equal(booking.dialog.open,true);assert.equal(booking.account.checked,true);assert.equal(booking.go.href,'https://marriagefamilytherapy.clientsecure.me/request');
  assert.equal(booking.click(booking.go).defaultPrevented,false);assert.equal(x.ops.length,1);assert.equal(events(x).length,0);assert.equal(x.reloads(),0);
 }
});
