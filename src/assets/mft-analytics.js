/* Consent-gated first-party handoffs; a separate reviewed Google purpose, when
 * installed, has its own permission and sender. Neither path gates scheduling. */
(()=>{'use strict';
function googleRuntime(){
 const candidate=window.MFTGoogleMeasurement;
 try{return candidate&&candidate.available()===true?candidate:null;}catch{return null;}
}
const current=document.currentScript;
if(!current||window.__MFT_FIRST_PARTY_ANALYTICS__)return;
const pageKey=current.dataset.mftPageKey;
if(!/^[a-f0-9]{16}$/.test(pageKey||'')||!['https://www.mft.care','https://mft.care'].includes(location.origin))return;
window.__MFT_FIRST_PARTY_ANALYTICS__=true;
// Prevent an older controller loaded later in this document from starting.
window.__MFT_GA4_BASIC__=true;
if(!googleRuntime())window['ga-disable-G-BTK39BBNRE']=true;
const consentKey='mft.analytics.consent.v5';
// This is the unchanged Ops receiving/data-scope contract, not the browser
// notice revision. The v5 choice narrows the existing permission to M.F.T.
const receivingConsentVersion='mft.analytics.consent.v4';
const previousConsentKeys=['mft.analytics.consent.v4','mft.analytics.consent.v3','mft.analytics.consent.v2'];
const advertisingConsentKey='mft.advertising.consent.v1';
const conditionalAdvertisingConsentKey='mft.advertising.consent.v2',googleSourceKey='mft.google.source.v1';
const sourceKey='mft.analytics.source.v1';
const handoffEndpoint=current.dataset.mftHandoffEndpoint==='https://ops.mft.care/api/marketing/attribution'?current.dataset.mftHandoffEndpoint:null;
const acquisitionLifetime=1800000;
const events=new Set(['appointment_request_click','clinician_schedule_click','consultation_click','simplepractice_exit']);
const placements=new Set(['header','footer','body','dialog']);
const campaigns=new Set(['24274542446','24362234053','24435101888','24444626634','24449945489','24530528782','24524392745']);
let choice='unset',returnFocus=null,source=null,consentGeneration=0,googleContextExpiry=0;
const handoffRequests=new Set();
function privacySignal(){return navigator.globalPrivacyControl===true||navigator.doNotTrack==='1';}
function status(){return privacySignal()?'denied':choice;}
function save(value){choice=value;try{localStorage.setItem(consentKey,value);}catch{}}
try{
 const saved=localStorage.getItem(consentKey);
 if(['granted','denied'].includes(saved))choice=saved;
 else{
  const existing=localStorage.getItem(previousConsentKeys[0]);
  if(['granted','denied'].includes(existing)){
   // A valid v4 choice already covered this same first-party scope. It cannot
   // authorize advertising; newer grants are never written to an older key.
   save(existing);
  }else{
   const previous=localStorage.getItem(previousConsentKeys[1]);
   if(previous==='denied'||(!['granted','denied'].includes(previous)&&localStorage.getItem(previousConsentKeys[2])==='denied'))choice='denied';
  }
 }
}catch{}
function advertisingStatus(){try{return window.MFTGoogleMeasurement?.status()||'unavailable';}catch{return 'unavailable';}}
function clearCookies(){
 // The standard tag also stores a backup in this named localStorage key.
 // Delete only Google measurement state; keep functional scheduling choices.
 try{localStorage.removeItem('_gcl_ls');}catch{}
 const host=new URL(location.origin).hostname;
 let cookies='';try{cookies=document.cookie;}catch{}
 for(const part of cookies.split(';')){
  const name=part.split('=')[0].trim();
  if(!/^(?:mftga_|_ga(?:_|$)|_gcl_(?:au|aw|dc|gb|gs)$)/.test(name))continue;
  // These legacy first-party Google cookies used the root path. Cover both
  // host-only and public-domain scope without touching the account preference.
  for(const domain of ['',host,'mft.care']){try{document.cookie=name+'=; Max-Age=0; Path=/; SameSite=Lax; Secure'+(domain?'; Domain='+domain:'');}catch{}}
 }
}
function retainGoogleContext(){
 // An excluded page never reads ad parameters or loads Google. It may retain
 // only a previously consented, bounded source for a later eligible page.
 let permission=null,context=null;
 try{permission=JSON.parse(localStorage.getItem(conditionalAdvertisingConsentKey)||'null');context=JSON.parse(sessionStorage.getItem(googleSourceKey)||'null');}catch{}
 const now=Date.now(),currentGrant=!privacySignal()&&permission?.choice==='granted'&&
  /^[a-f0-9]{64}$/.test(permission.review||'')&&Number.isSafeInteger(permission.expiresAt)&&
  permission.expiresAt>now&&permission.expiresAt<=now+acquisitionLifetime&&
  Object.keys(permission).sort().join(',')==='choice,expiresAt,review';
 const valid=currentGrant&&
  context?.review===permission.review&&context.expiresAt===permission.expiresAt&&
  Object.keys(context).sort().join(',')==='clickIds,expiresAt,review'&&context.clickIds&&
  typeof context.clickIds==='object'&&!Array.isArray(context.clickIds)&&
  Object.entries(context.clickIds).every(([key,value])=>['gclid','gbraid','wbraid'].includes(key)&&typeof value==='string'&&/^[A-Za-z0-9_~-]{1,255}$/.test(value));
 if(!valid){
  try{sessionStorage.removeItem(googleSourceKey);}catch{}
  if(!currentGrant)clearCookies();
  if(privacySignal()){try{localStorage.setItem(conditionalAdvertisingConsentKey,JSON.stringify({choice:'denied'}));}catch{}}
  return;
 }
 if(googleContextExpiry!==context.expiresAt){
  googleContextExpiry=context.expiresAt;
  // Re-read current state: an older BFCache document must not erase a newer
  // independently granted context. This never renews the original deadline.
  setTimeout(()=>retainGoogleContext(),Math.max(0,context.expiresAt-now));
 }
}
function disableAdvertising(){
 const google=googleRuntime();
 if(google){google.enforceBoundary();return;}
 window['ga-disable-G-BTK39BBNRE']=true;
 try{localStorage.setItem(advertisingConsentKey,'denied');}catch{}
 retainGoogleContext();
 // Excluded routes keep no native Google cookies. Only validated consented
 // session source can survive; GA browser/session continuity is not promised.
 clearCookies();
 // Compatibility cleanup only. No frame, Google loader, dataLayer or gtag is
 // created, and old helper messages have no active receiver in this controller.
 for(const frame of document.querySelectorAll?.('iframe[title="Optional website traffic measurement"]')||[]){
  try{frame.contentWindow['ga-disable-G-BTK39BBNRE']=true;}catch{}
  frame.remove();
 }
}
function denyAdvertising(){
 const google=googleRuntime();
 if(google){google.deny();return;}
 try{localStorage.setItem(conditionalAdvertisingConsentKey,JSON.stringify({choice:'denied'}));}catch{}
 disableAdvertising();
}
function safeReferrer(){
 try{const u=new URL(document.referrer);return ['https://www.google.com','https://www.bing.com','https://google.com','https://bing.com'].includes(u.origin)?u.origin+'/':'';}catch{return '';}
}
function cleanSource(value){
 const a=value&&typeof value==='object'?value:{};
 const pairs=['google/cpc','google/organic','bing/organic','direct/none','referral/referral','other/unknown','unknown/unknown'];
 if(!pairs.includes(a.source+'/'+a.medium))return {source:'unknown',medium:'unknown'};
 const out={source:a.source,medium:a.medium};
 if(a.source==='google'&&a.medium==='cpc'&&campaigns.has(a.campaignId))out.campaignId=a.campaignId;
 return out;
}
function acquisition(){
 // Read once, only after consent; never retain/transmit raw queries or click IDs.
 // Recognizing a marker supplies an internal source label, not Ads attribution.
 const now=Date.now();
 let expiresAt=now+acquisitionLifetime;
 const q=new URLSearchParams(location.search),s=(q.get('utm_source')||'').toLowerCase(),m=(q.get('utm_medium')||'').toLowerCase();
 const click=['gclid','gbraid','wbraid'].some(k=>/^[A-Za-z0-9_~-]{1,255}$/.test(q.get(k)||''));
 let a={source:'direct',medium:'none'},explicit=Boolean(s||m||click);
 if(click||(s==='google'&&['cpc','ppc','paid_search','paidsearch'].includes(m)))a={source:'google',medium:'cpc',campaignId:q.get('utm_campaign_id')||q.get('utm_id')};
 else if(['google','bing'].includes(s)&&m==='organic')a={source:s,medium:'organic'};
 else if(explicit)a={source:'other',medium:'unknown'};
 else if(safeReferrer())a={source:safeReferrer().includes('bing.com')?'bing':'google',medium:'organic'};
 else if(document.referrer){try{if(!['mft.care','www.mft.care'].includes(new URL(document.referrer).hostname))a={source:'referral',medium:'referral'};}catch{a={source:'unknown',medium:'unknown'};}}
 try{
  const old=JSON.parse(sessionStorage.getItem(sourceKey)||'null');
  if(!explicit&&a.source==='direct'&&old&&Number.isSafeInteger(old.expiresAt)&&old.expiresAt>now&&old.expiresAt<=now+acquisitionLifetime){
   a=cleanSource(old);expiresAt=old.expiresAt;
  }
 }catch{}
 a=cleanSource(a);
 const acquired={...a,expiresAt};
 try{sessionStorage.setItem(sourceKey,JSON.stringify(acquired));}catch{}
 return acquired;
}
function expireSource(){
 if(!source||source.expiresAt>Date.now())return;
 const expired=source;
 source={source:'direct',medium:'none',expiresAt:0};
 // A restored document's old timer must not erase a newer navigation's source.
 try{const stored=JSON.parse(sessionStorage.getItem(sourceKey)||'null');if(!stored||stored.expiresAt===expired.expiresAt)sessionStorage.removeItem(sourceKey);}catch{}
}
function start(){
 if(status()!=='granted'||!handoffEndpoint||source)return;
 source=acquisition();
 const acquired=source;
 setTimeout(()=>{if(source===acquired)expireSource();},Math.max(0,acquired.expiresAt-Date.now()));
}
function removeBanner(){document.getElementById('mft-analytics-consent')?.remove();returnFocus?.focus();returnFocus=null;}
function stop(){
 consentGeneration++;
 for(const request of handoffRequests)request.abort();
 handoffRequests.clear();source=null;
 try{sessionStorage.removeItem(sourceKey);}catch{}
 disableAdvertising();
}
function handoffId(){
 if(typeof crypto==='undefined'||typeof crypto.getRandomValues!=='function')return null;
 if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
 const bytes=crypto.getRandomValues(new Uint8Array(16));
 bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const value=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 return value.slice(0,8)+'-'+value.slice(8,12)+'-'+value.slice(12,16)+'-'+value.slice(16,20)+'-'+value.slice(20);
}
function recordHandoff(placement){
 if(!handoffEndpoint||status()!=='granted'||typeof fetch!=='function')return;
 try{
  const eventId=handoffId();
  if(!eventId)return;
  start();expireSource();
  const attribution=source&&source.expiresAt>Date.now()?cleanSource(source):{source:'direct',medium:'none'};
  const body=JSON.stringify({schemaVersion:1,eventType:'simplepractice_exit',eventId,occurredAt:new Date().toISOString(),consentVersion:receivingConsentVersion,...attribution,pageCode:pageKey,placement});
  const generation=consentGeneration;
  const attempt=(retry)=>{
   if(privacySignal()){stop();return;}
   if(status()!=='granted'||generation!==consentGeneration||(!retry&&document.visibilityState==='hidden'))return;
   const controller=typeof AbortController==='function'?new AbortController():null;
   if(controller)handoffRequests.add(controller);
   const again=()=>{
    if(privacySignal()){stop();return;}
    if(retry&&status()==='granted'&&generation===consentGeneration&&document.visibilityState!=='hidden')setTimeout(()=>attempt(false),250);
   };
   try{
    Promise.resolve(fetch(handoffEndpoint,{method:'POST',mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',keepalive:true,headers:{'Content-Type':'text/plain;charset=UTF-8'},body,...(controller?{signal:controller.signal}:{})}))
     .then(response=>{if(response?.status===429||response?.status>=500)again();},again)
     .finally(()=>{if(controller)handoffRequests.delete(controller);}).catch(()=>{});
   }catch{if(controller)handoffRequests.delete(controller);again();}
  };
  // Same immutable action ID, UTC timestamp and source on the single bounded
  // retry. No persistent delivery queue or visitor identifier is created.
  attempt(true);
 }catch{}
}
function track(names,placement,done,eligibility){
 const allowed=[...new Set(Array.isArray(names)?names:[])].filter(name=>events.has(name));
 const permitted=status()==='granted'&&allowed.length>0&&placements.has(placement);
 if(permitted&&allowed.includes('simplepractice_exit'))recordHandoff(placement);
 let googleHandled=false;
 if(eligibility?.googleGenericHandoff===true&&placements.has(placement)&&allowed.includes('simplepractice_exit')&&!allowed.includes('clinician_schedule_click')){
  // The independent sender accepts no payload: never expose an Ops action ID,
  // page code, placement, clinician, destination or diagnostic event to Google.
  try{googleHandled=googleRuntime()?.handoff()===true;}catch{}
 }
 if(privacySignal())stop();
 // Diagnostic callbacks indicate local handling only, never receiver receipt.
 // Native scheduling does not wait for any callback or measurement request.
 if(typeof done==='function')done();
 return Boolean(permitted||googleHandled);
}
function grant(){if(privacySignal()){deny();return;}save('granted');disableAdvertising();removeBanner();start();}
function deny(){
 save('denied');
 // Only withdrawals flow backward. An Ops-only grant must never reactivate
 // Google in an already-open v4 (or older) website document.
 for(const key of previousConsentKeys){try{localStorage.setItem(key,'denied');}catch{}}
 stop();removeBanner();
}
function banner(force=false){
 const google=googleRuntime(),needsGoogleChoice=google?.status()==='unset';
 const googleReload=google?.requiresReload?.()===true;
 if((status()!=='unset'&&!needsGoogleChoice&&!force)||document.getElementById('mft-analytics-consent'))return;
 const el=document.createElement('aside');el.id='mft-analytics-consent';el.className='mft-analytics-consent';
 el.setAttribute('role','dialog');el.setAttribute('aria-label','Analytics privacy choice');
 const advertising=google?'<span data-mft-advertising-status="'+google.status()+'">Google advertising measurement is a separate choice. If allowed, Google receives the public page address and title, visit activity, and a scheduling-link click, linked to ad-click and browser identifiers. Google also receives ordinary connection information, including your IP address, and may use existing Google cookies for measurement. A scheduling click does not confirm an appointment. Website-controlled source context is usable for 30 minutes; Google has separate retention rules. Personalized advertising remains off. '+(googleReload?'Allowing Google again reloads this page to start a new measurement session. ':'')+'<span class="mft-analytics-consent-actions"><button type="button" data-choice="grant-ad" aria-label="Allow Google advertising measurement'+(googleReload?' and reload this page':'')+'">'+(googleReload?'Allow Google and reload':'Allow Google')+'</button><button type="button" data-choice="deny-ad" aria-label="Decline Google advertising measurement">Decline Google</button></span></span>':window.MFTGoogleMeasurement?'<span data-mft-advertising-status="'+advertisingStatus()+'">Google measurement is off for this page. You can manage this choice on a page where the option is available.</span>':'<span data-mft-advertising-status="unavailable">Google Analytics and advertising measurement are disabled because scheduling activity can reveal an interest in care.</span>';
 el.innerHTML='<div class="mft-analytics-consent-heading"><strong>Optional website analytics</strong><button type="button" data-choice="dismiss" aria-label="Close analytics notice">Close</button></div><p tabindex="0" role="region" aria-label="How optional analytics work">Allow M.F.T. to record coded scheduling-link clicks with limited traffic-source information. M.F.T. keeps these click records for 30 days, with removal during daily cleanup. A random event ID prevents duplicate counting and is not sent to Google or SimplePractice. Opening scheduling is not an appointment request or booking. This measurement does not include names, contact details, page text, clinician selections, form entries, appointment details, or client records. '+advertising+' You can change these choices using Analytics choices in the footer. Allow analytics changes only the M.F.T. choice.</p><div class="mft-analytics-consent-actions"><button type="button" data-choice="deny">Decline</button><button type="button" data-choice="grant">Allow analytics</button></div>';
 if(privacySignal()){el.querySelector('p').textContent='Your browser privacy signal is on. Optional analytics are disabled. Google Analytics and advertising measurement remain unavailable.';el.querySelector('[data-choice="grant"]').remove();}
 el.addEventListener('click',e=>{
  const action=e.target?.dataset?.choice;
  if(action==='grant')grant();
  if(action==='deny'){deny();denyAdvertising();}
  if(action==='grant-ad'){google?.grant();removeBanner();}
  if(action==='deny-ad'){google?.deny();removeBanner();}
  if(action==='dismiss')removeBanner();
 });
 document.body.appendChild(el);if(force)el.querySelector('button').focus();
}
function setup(){
 const footer=document.querySelector('footer');if(footer){const button=document.createElement('button');button.type='button';button.className='mft-analytics-settings';button.textContent='Analytics choices';button.addEventListener('click',()=>{returnFocus=button;banner(true);});footer.appendChild(button);}
 if(privacySignal())deny();else{
  if(status()==='granted')start();else stop();
  if(status()==='unset'||googleRuntime()?.status()==='unset')banner();
 }
}
window.MFTAnalyticsConsent={grant,deny,status,advertisingStatus,show:()=>banner(true)};
const google=googleRuntime();
window.MFTAdvertisingConsent=google?{version:google.preferenceVersion,status:advertisingStatus,grant:()=>google.grant(),deny:()=>google.deny()}:{version:advertisingConsentKey,status:advertisingStatus,deny:denyAdvertising};
window.MFTSchedulingMeasurement={track};
window.addEventListener('storage',e=>{
 if(e.key===advertisingConsentKey){disableAdvertising();return;}
 if(e.key===conditionalAdvertisingConsentKey){if(!googleRuntime())disableAdvertising();return;}
 if(previousConsentKeys.includes(e.key)&&e.newValue==='denied'){deny();return;}
 if(e.key!==consentKey&&e.key!==null)return;
 if(e.key===consentKey&&e.newValue==='granted'&&!privacySignal()){choice='granted';disableAdvertising();removeBanner();start();}
 else deny();
});
disableAdvertising();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
