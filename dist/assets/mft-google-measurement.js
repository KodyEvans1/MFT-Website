/* Conditional main-page Google sender. A reviewed build must explicitly install
 * it; this file's presence grants neither route approval nor visitor consent.
 * Supported APIs: developers.google.com/tag-platform/security/guides/consent
 * and developers.google.com/analytics/devguides/collection/ga4/reference/config.
 */
(()=>{'use strict';
const current=document.currentScript;
if(!current||window.__MFT_GOOGLE_MEASUREMENT__)return;
const data=current.dataset,id='G-BTK39BBNRE',eventName='simplepractice_exit';
const routes=new Set(['/','/about/']),route=data.mftGoogleRoute,review=data.mftGoogleApprovedReview;
// The native Ads-linked conversion leg reads document.title even when GA4's
// page_title override is set. Admit only the reviewed public page titles;
// never rewrite a private title to conceal an otherwise ineligible document.
const reviewedTitles=Object.freeze({
 '/':'Marriage.Family.Therapy | Woodinville & Online in Washington',
 '/about/':'About Marriage.Family.Therapy | Woodinville, WA'
});
if(location.origin!=='https://www.mft.care'||data.mftGoogleMode!=='approved-main-page'||
 data.mftGoogleMeasurementId!==id||data.mftGoogleEvent!==eventName||
 !routes.has(route)||location.pathname!==route||!/^[a-f0-9]{64}$/.test(review||''))return;
window.__MFT_GOOGLE_MEASUREMENT__=true;
window.__MFT_GA4_BASIC__=true; // Never revive the retired iframe controller.
const consentKey='mft.advertising.consent.v2',sourceKey='mft.google.source.v1',lifetime=1800000;
const previousGoogleConsentKeys=['mft.analytics.consent.v4','mft.analytics.consent.v3','mft.analytics.consent.v2'];
const clickKeys=['gclid','gbraid','wbraid'];
const campaigns=new Set(['24274542446','24362234053','24435101888','24444626634','24449945489','24530528782','24524392745']);
// A further CSP intersects with the response policy. Preserve the existing
// first-party/SimplePractice sources while denying every Google request type,
// including vendor diagnostics that do not honor the GA disable flag. This
// policy cannot be loosened again in the same document.
const stoppedPolicy="default-src 'self'; img-src 'self' https://images.squarespace-cdn.com data:; script-src 'self' https://widget-cdn.simplepractice.com; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self' https://clientsecure.me https://marriagefamilytherapy.clientsecure.me https://ops.mft.care; frame-src https://clientsecure.me https://marriagefamilytherapy.clientsecure.me https://spwidget-marriagefamilytherapy.clientsecure.me; worker-src 'none'; base-uri 'self'; form-action 'self' https://ops.mft.care https://marriagefamilytherapy.clientsecure.me";
let permission=null,context=null,loader=null,started=false,ready=false,stopped=false,blocked=false;
let ownedQueue=null,observer=null,networkStopped=false,reloadRequested=false,supersededGrant=false;
function signal(){return navigator.globalPrivacyControl===true||navigator.doNotTrack==='1';}
function read(storage,key){try{return JSON.parse(storage.getItem(key)||'null');}catch{return null;}}
function write(storage,key,value){try{storage.setItem(key,JSON.stringify(value));}catch{}}
function remove(storage,key){try{storage.removeItem(key);}catch{}}
function validGrant(value){return value&&value.choice==='granted'&&value.review===review&&
 Number.isSafeInteger(value.expiresAt)&&value.expiresAt>Date.now()&&value.expiresAt<=Date.now()+lifetime;}
function newerGrant(value){return value?.choice==='granted'&&/^[a-f0-9]{64}$/.test(value.review||'')&&
 Number.isSafeInteger(value.expiresAt)&&value.expiresAt>Date.now()&&value.expiresAt<=Date.now()+lifetime&&
 Number.isSafeInteger(permission?.expiresAt)&&value.expiresAt>permission.expiresAt&&
 Object.keys(value).sort().join(',')==='choice,expiresAt,review';}
const saved=read(localStorage,consentKey);
if(saved?.choice==='denied')permission={choice:'denied'};
else if(validGrant(saved))permission={choice:'granted',review,expiresAt:saved.expiresAt};
function hasReviewedTitle(){return document.title===reviewedTitles[route];}
function available(){
 if(location.origin!=='https://www.mft.care'||location.pathname!==route||!hasReviewedTitle())return false;
 // The choice may be offered again, but a clamped document cannot resume its
 // vendor. Only a new explicit grant followed by a fresh document can do so.
 return networkStopped?!hasUnapprovedControls():!blocked&&!(started&&stopped);
}
function status(){if(signal()||permission?.choice==='denied')return 'denied';if(!available()||networkStopped)return 'unavailable';return validGrant(permission)?'granted':'unset';}
function stopNetwork(){
 if(!started||networkStopped)return;
 const policy=document.createElement('meta');
 policy.httpEquiv='Content-Security-Policy';policy.content=stoppedPolicy;
 policy.setAttribute('data-mft-google-stopped','true');
 document.head.appendChild(policy);networkStopped=true;
}
function clearCookies(){
 // The observed vendor uses this unprefixed localStorage backup for native
 // ad-click state. Its expiry metadata does not physically delete the key in
 // an inactive browser. Remove only this known Google-owned backup here.
 remove(localStorage,'_gcl_ls');
 let value='';try{value=document.cookie;}catch{}
 for(const part of value.split(';')){
  const name=part.split('=')[0].trim();
  if(!/^(?:mftga_|_ga(?:_|$)|_gid$|_gat(?:_|$)|_gcl_)/.test(name))continue;
  for(const domain of ['','www.mft.care','mft.care']){try{document.cookie=name+'=; Max-Age=0; Path=/; SameSite=Lax; Secure'+(domain?'; Domain='+domain:'');}catch{}}
 }
}
function halt(preserveNewerGrant=false){
 window['ga-disable-'+id]=true;
 stopped=true;ready=false;
 // Apply the native browser boundary synchronously, before a vendor listener
 // later in the same visibility/pagehide task can start another request.
 // It prevents subsequent requests; it cannot retract an earlier disclosure.
 stopNetwork();
 // A suspended/BFCache document can expire after another document obtained a
 // fresh, independent grant. Stop this document without erasing that newer
 // window's context or shared Google cookies. Explicit withdrawal still clears
 // all measurement state, including state created under a newer grant.
 const latest=preserveNewerGrant||supersededGrant?read(localStorage,consentKey):null;
 const newer=newerGrant(latest);
 const stored=newer?read(sessionStorage,sourceKey):null;
 const newerSource=newer&&stored?.review===latest.review&&stored.expiresAt===latest.expiresAt&&validIds(stored.clickIds)&&
  Object.keys(stored).sort().join(',')==='clickIds,expiresAt,review';
 if(!newerSource)remove(sessionStorage,sourceKey);
 context=null;if(!newer)clearCookies();
 if(ownedQueue){ownedQueue.length=0;window.gtag=function(){};}
 observer?.disconnect();observer=null;
 loader?.remove();loader=null;
 // Stopping never navigates or reloads: an open scheduling dialog and its
 // native Continue remain intact. No denied-consent ping is deliberately
 // emitted. Regranting below requires a separate explicit choice and reload.
}
function deny(){supersededGrant=false;permission={choice:'denied'};write(localStorage,consentKey,permission);halt();}
function enforceBoundary(){
 if(signal()){deny();return false;}
 if(status()!=='granted'){halt(Number.isSafeInteger(permission?.expiresAt)&&permission.expiresAt<=Date.now());return false;}
 if(location.hash||hasUnapprovedControls()||!currentQueryContext()){blocked=true;halt();return false;}
 return true;
}
function validId(value){return typeof value==='string'&&/^[A-Za-z0-9_~-]{1,255}$/.test(value);}
function validIds(value){return value&&typeof value==='object'&&!Array.isArray(value)&&
 Object.keys(value).every(key=>clickKeys.includes(key)&&validId(value[key]));}
function currentQueryContext(){
 // No query access before the separate, current Google-purpose grant.
 // This parser is also used by lifecycle/DOM enforcement. It must not renew
 // permission, change attribution storage, or touch vendor cookies.
 const query=new URLSearchParams(location.search),seen=new Set(),clickIds={};
 let explicitSource=false;
 for(const [key,value]of query){
  if(seen.has(key))return null;seen.add(key);
  if(clickKeys.includes(key)){if(!validId(value))return null;clickIds[key]=value;continue;}
  explicitSource=true;
  if(key==='utm_source'&&value==='google')continue;
  if(key==='utm_medium'&&value==='cpc')continue;
  if(['utm_campaign_id','utm_id'].includes(key)&&campaigns.has(value))continue;
  if(['utm_adgroup_id','utm_creative_id'].includes(key)&&/^\d{1,20}$/.test(value))continue;
  if(key==='utm_network'&&['g','s','d','y','v','x','p'].includes(value))continue;
  if(key==='utm_device'&&['m','c','t'].includes(value))continue;
  // Fail closed on free text, contact fields, linker inputs and unknown query
  // fields instead of letting a vendor inspect the unsanitized page context.
  return null;
 }
 if(location.hash)return null;
 return {clickIds,explicitSource};
}
function queryContext(){
 const currentQuery=currentQueryContext();if(!currentQuery)return null;
 const {clickIds,explicitSource}=currentQuery;
 const old=read(sessionStorage,sourceKey);
 const validOld=old&&old.review===review&&old.expiresAt===permission.expiresAt&&
  Number.isSafeInteger(old.expiresAt)&&old.expiresAt>Date.now()&&validIds(old.clickIds)&&
  Object.keys(old).sort().join(',')==='clickIds,expiresAt,review';
 if(!validOld){remove(sessionStorage,sourceKey);clearCookies();}
 const acquired={review,expiresAt:permission.expiresAt,clickIds:
  Object.keys(clickIds).length||explicitSource||!validOld?clickIds:old.clickIds};
 write(sessionStorage,sourceKey,acquired);
 return acquired;
}
function pageLocation(){
 const url=new URL('https://www.mft.care'+route);
 for(const key of clickKeys){if(context?.clickIds[key])url.searchParams.set(key,context.clickIds[key]);}
 return url.href;
}
function hasOtherSender(){
 if(typeof window.gtag==='function'||window.dataLayer!==undefined)return true;
 return Array.from(document.querySelectorAll('script[src],iframe[src]')).some(element=>
  /(?:googletagmanager\.com|google-analytics\.com|mft-ga4-(?:bootstrap|frame|page)\.)/.test(element.src||''));
}
function hasUnapprovedControls(){
 return Array.from(document.querySelectorAll('form,input,textarea')).some(element=>{
  if(!element.closest('dialog.mft-consultation-gate'))return true;
  return !element.matches('form,input[type="checkbox"][data-mft-account-ack],input[type="checkbox"][data-mft-consultation-ack]');
 });
}
function start(){
 if(started||stopped||!enforceBoundary())return false;
 if(hasOtherSender()||hasUnapprovedControls()){blocked=true;halt();return false;}
 context=queryContext();
 if(!context){blocked=true;halt();return false;}
 // Default denial is queued before every set/config/event. The vendor itself
 // is not requested until the distinct permission and route checks pass.
 const queue=[];ownedQueue=queue;window.dataLayer=queue;
 window.gtag=function(){if(!stopped)queue.push(arguments);};
 const gtag=window.gtag;
 gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
 const configuration={send_page_view:false,page_location:pageLocation(),page_title:'M.F.T. Public Website',page_referrer:'',
  allow_google_signals:false,allow_ad_personalization_signals:false,allow_enhanced_conversions:false,
  cookie_domain:'none',cookie_path:'/',cookie_prefix:'mftga',cookie_flags:'SameSite=Lax;Secure',
  cookie_expires:Math.max(1,Math.floor((permission.expiresAt-Date.now())/1000)),cookie_update:false};
 gtag('set',{...configuration,ads_data_redaction:true,url_passthrough:false});
 gtag('set','linker',{domains:[],accept_incoming:false,decorate_forms:false});
 gtag('consent','update',{analytics_storage:'granted',ad_storage:'granted',ad_user_data:'granted',ad_personalization:'denied'});
 gtag('js',new Date());
 if(!enforceBoundary())return false;
 gtag('config',id,configuration);
 window['ga-disable-'+id]=false;
 loader=document.createElement('script');loader.async=true;loader.referrerPolicy='no-referrer';
 loader.src='https://www.googletagmanager.com/gtag/js?id='+id;
 loader.addEventListener('load',()=>{if(enforceBoundary()&&!stopped)ready=true;});
 loader.addEventListener('error',()=>{blocked=true;halt();});
 if(typeof MutationObserver==='function'){
  observer=new MutationObserver(()=>enforceBoundary());
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true});
 }
 if(!enforceBoundary())return false;
 started=true;document.head.appendChild(loader);
 const expiresAt=permission.expiresAt;
 setTimeout(()=>{if(permission?.expiresAt===expiresAt&&Date.now()>=expiresAt)halt(true);},Math.max(0,expiresAt-Date.now()));
 return true;
}
function grant(){
 if(signal()){deny();return false;}
 if(!available())return false;
 if(networkStopped){
  // Only this explicit choice may start a fresh document. Validate the live
  // context before saving it; never remove the CSP or revive the old queue.
  if(reloadRequested||hasUnapprovedControls()||!currentQueryContext())return false;
  const fresh={choice:'granted',review,expiresAt:Date.now()+lifetime};
  write(localStorage,consentKey,fresh);
  const persisted=read(localStorage,consentKey);
  if(!validGrant(persisted)||persisted.expiresAt!==fresh.expiresAt||
   Object.keys(persisted).sort().join(',')!=='choice,expiresAt,review')return false;
  permission=fresh;supersededGrant=false;reloadRequested=true;
  try{location.reload();return true;}catch{reloadRequested=false;return false;}
 }
 if(stopped&&started)return false;
 if(!validGrant(permission)){
  permission={choice:'granted',review,expiresAt:Date.now()+lifetime};write(localStorage,consentKey,permission);
 }
 stopped=false;
 return start()||started;
}
function handoff(){
 // No event queue is retained before consent or vendor readiness. No parameter
 // from Ops, the booking link, its placement or a clinician is accepted here.
 if(!ready||stopped||!enforceBoundary())return false;
 if(location.pathname!==route||location.hash||hasUnapprovedControls()){blocked=true;halt();return false;}
 const safe=queryContext();if(!safe){blocked=true;halt();return false;}context=safe;
 window.gtag('event',eventName,{send_to:id,page_location:pageLocation(),page_title:'M.F.T. Public Website',page_referrer:''});
 return true;
}
window.MFTGoogleMeasurement={available,status,grant,deny,handoff,enforceBoundary,requiresReload:()=>networkStopped,preferenceVersion:consentKey};
window.addEventListener('storage',event=>{
 if(event.key===null){deny();return;}
 // These older choices explicitly covered Google. A new refusal in an open
 // legacy tab must revoke this sender too. The advertising.v1 value is not
 // equivalent: excluded-page maintenance automatically writes it as denied.
 // The current v5 analytics-only preference remains independently controlled.
 if(previousGoogleConsentKeys.includes(event.key)&&event.newValue==='denied'){deny();return;}
 if(event.key!==consentKey)return;
 const incoming=read(localStorage,consentKey);
 if(incoming?.choice==='denied'){deny();return;}
 // Other-tab grants cannot replay actions, renew the window, or reactivate a
 // stopped document. A normal subsequent page load may use the current grant.
 if(!validGrant(incoming)){
  // A newer review may be active in another document. Keep this document's
  // original permission snapshot for expiry comparisons; neither adopt that
  // grant nor erase its shared state on this or later lifecycle callbacks.
  supersededGrant=newerGrant(incoming);
  if(!supersededGrant)permission=null;
  halt(supersededGrant);
 }
});
// Register before the vendor. A title/control change and a visibility or
// pagehide event can occur in one task, before MutationObserver callbacks.
// Capture-phase checks stop that document before vendor engagement listeners.
document.addEventListener('visibilitychange',()=>enforceBoundary(),true);
window.addEventListener('pagehide',()=>enforceBoundary(),true);
window.addEventListener('pageshow',()=>enforceBoundary(),true);
if(status()==='granted')start();else{window['ga-disable-'+id]=true;remove(sessionStorage,sourceKey);clearCookies();}
})();
