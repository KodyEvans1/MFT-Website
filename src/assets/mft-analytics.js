/* Consent-gated public measurement. Google never runs in the care-page document. */
(()=>{'use strict';
const current=document.currentScript;
if(!current||window.__MFT_GA4_BASIC__)return;
const measurementId=current.dataset.mftMeasurementId,pageKey=current.dataset.mftPageKey;
if(measurementId!=='G-BTK39BBNRE'||!/^[a-f0-9]{16}$/.test(pageKey||'')||!['https://www.mft.care','https://mft.care'].includes(location.origin))return;
window.__MFT_GA4_BASIC__=true;
const consentKey='mft.analytics.consent.v4',previousConsentKey='mft.analytics.consent.v3',legacyConsentKey='mft.analytics.consent.v2';
const sourceKey='mft.analytics.source.v1',frameVersion=current.dataset.mftFrameVersion;
const handoffEndpoint=current.dataset.mftHandoffEndpoint==='https://ops.mft.care/api/marketing/attribution'?current.dataset.mftHandoffEndpoint:null;
const acquisitionLifetime=1800000;
if(!/^[a-f0-9]{16}$/.test(frameVersion||''))return;
const events=new Set(['appointment_request_click','clinician_schedule_click','consultation_click','simplepractice_exit']);
const placements=new Set(['header','footer','body','dialog']);
// Owner-supplied current campaigns plus the historical reviewed campaign.
const campaigns=new Set(['24274542446','24362234053','24435101888','24444626634','24449945489','24530528782','24524392745']);
let choice='unset',frame=null,returnFocus=null,measured=false,ready=false,sequence=0;
let queue=[],source=null,consentGeneration=0;
const callbacks=new Map();
const handoffRequests=new Set();
try{
 const saved=localStorage.getItem(consentKey);
 if(['granted','denied'].includes(saved))choice=saved;
 else{
  const previous=localStorage.getItem(previousConsentKey);
  // A Google-only grant does not silently authorize the added first-party
  // recipient. The latest valid refusal still takes precedence over older data.
  if(previous==='denied'||(!['granted','denied'].includes(previous)&&localStorage.getItem(legacyConsentKey)==='denied'))choice='denied';
 }
}catch{}
function privacySignal(){return navigator.globalPrivacyControl===true||navigator.doNotTrack==='1';}
function status(){return privacySignal()?'denied':choice;}
function save(value){choice=value;try{localStorage.setItem(consentKey,value);}catch{}}
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
 // Internal navigation keeps the original deadline; it cannot renew acquisition.
 const acquired={...a,expiresAt};
 try{sessionStorage.setItem(sourceKey,JSON.stringify(acquired));}catch{}
 return acquired;
}
function removeBanner(){document.getElementById('mft-analytics-consent')?.remove();returnFocus?.focus();returnFocus=null;}
function clearCookies(){
 for(const part of document.cookie.split(';')){const name=part.split('=')[0].trim();if(/^mftga_/.test(name))document.cookie=name+'=; Max-Age=0; Path=/; SameSite=Lax; Secure';}
}
function finish(id){const done=callbacks.get(id);if(done){callbacks.delete(id);done();}}
function stop(){
 consentGeneration++;
 for(const request of handoffRequests)request.abort();
 handoffRequests.clear();
 if(frame){try{frame.contentWindow['ga-disable-'+measurementId]=true;}catch{}frame.remove();frame=null;}
 ready=false;queue=[];source=null;
 try{sessionStorage.removeItem(sourceKey);}catch{}
 clearCookies();
 for(const id of [...callbacks.keys()])finish(id);
}
function post(message){if(frame&&ready&&status()==='granted')frame.contentWindow.postMessage(message,location.origin);}
function deliverIntent(message){
 // Same-origin synchronous delivery avoids losing a queued postMessage when the
 // visitor follows a native link. The helper revalidates every scalar field.
 const receive=frame?.contentWindow?.MFTAnalyticsReceiveIntent;
 if(ready&&status()==='granted'&&typeof receive==='function')return receive(message);
 return false;
}
function send(){
 if(frame||status()!=='granted')return;
 if(!source)source=acquisition();
 const acquired=source;
 setTimeout(()=>{
  if(source!==acquired||acquired.expiresAt>Date.now())return;
  source={source:'direct',medium:'none',expiresAt:0};
  try{const stored=JSON.parse(sessionStorage.getItem(sourceKey)||'null');if(stored?.expiresAt===acquired.expiresAt)sessionStorage.removeItem(sourceKey);}catch{}
 },Math.max(0,acquired.expiresAt-Date.now()));
 frame=document.createElement('iframe');frame.width='1';frame.height='1';
 frame.style.cssText='position:fixed;left:-10px;top:-10px;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
 frame.setAttribute('inert','');frame.title='Optional website traffic measurement';
 frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;frame.referrerPolicy='no-referrer';
 frame.src='/assets/mft-ga4-frame.html?v='+frameVersion;
 document.body.appendChild(frame);
}
window.addEventListener('message',event=>{
 if(!frame||status()!=='granted'||event.source!==frame.contentWindow||event.origin!==location.origin)return;
 const data=event.data;
 if(data?.type==='mft:analytics:complete'){measured=true;return;}
 if(data?.type==='mft:analytics:ack'&&typeof data.id==='string'){finish(data.id);return;}
 if(data?.type==='mft:analytics:ready'&&!ready){
  ready=true;
  post({type:'mft:analytics:init',pageKey,referrer:safeReferrer(),source:cleanSource(source),sourceExpiresAt:source.expiresAt,sendPageView:!measured});
  for(const item of queue)post(item);
  queue=[];
 }
});
function handoffId(){
 if(typeof crypto==='undefined'||typeof crypto.getRandomValues!=='function')return null;
 if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
 const bytes=crypto.getRandomValues(new Uint8Array(16));
 bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const value=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 return value.slice(0,8)+'-'+value.slice(8,12)+'-'+value.slice(12,16)+'-'+value.slice(16,20)+'-'+value.slice(20);
}
function recordHandoff(placement){
 // Independent of the Google helper: a blocked tag cannot stop first-party
 // delivery, and neither delivery path can delay the native scheduling link.
 if(!handoffEndpoint||status()!=='granted'||typeof fetch!=='function')return;
 try{
  const eventId=handoffId();
  if(!eventId)return;
  if(!source)source=acquisition();
  const attribution=source.expiresAt>Date.now()?cleanSource(source):{source:'direct',medium:'none'};
  const body=JSON.stringify({schemaVersion:1,eventType:'simplepractice_exit',eventId,occurredAt:new Date().toISOString(),consentVersion:consentKey,...attribution,pageCode:pageKey,placement});
  const generation=consentGeneration;
  const attempt=(retry)=>{
   if(status()!=='granted'||generation!==consentGeneration||(!retry&&document.visibilityState==='hidden'))return;
   const controller=typeof AbortController==='function'?new AbortController():null;
   if(controller)handoffRequests.add(controller);
   const again=()=>{
    if(retry&&status()==='granted'&&generation===consentGeneration&&document.visibilityState!=='hidden')setTimeout(()=>attempt(false),250);
   };
   try{
    Promise.resolve(fetch(handoffEndpoint,{method:'POST',mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',keepalive:true,headers:{'Content-Type':'text/plain;charset=UTF-8'},body,...(controller?{signal:controller.signal}:{})}))
     .then(response=>{if(response?.status===429||response?.status>=500)again();},again)
     .finally(()=>{if(controller)handoffRequests.delete(controller);}).catch(()=>{});
   }catch{if(controller)handoffRequests.delete(controller);again();}
  };
  // The immutable body (including the ID and UTC action time) is reused once
  // after a transient failure. No cross-page delivery queue or visitor ID.
  attempt(true);
 }catch{}
}
function track(names,placement,done){
 const requested=Array.isArray(names)?names:[];
 const allowed=[...new Set(requested)].filter(name=>events.has(name));
 if(status()!=='granted'||!allowed.length||!placements.has(placement)){if(typeof done==='function')done();return false;}
 if(allowed.includes('simplepractice_exit'))recordHandoff(placement);
 const id='m'+(++sequence);
 if(typeof done==='function'){
  let completed=false;
  callbacks.set(id,()=>{if(!completed){completed=true;done();}});
  // Diagnostic completion only. Booking links never wait for this callback.
  setTimeout(()=>finish(id),2000);
 }
 try{
  send();
  const item={type:'mft:analytics:intent',id,names:allowed,placement};
  if(ready){if(!deliverIntent(item))post(item);}else if(queue.length<8)queue.push(item);else finish(id);
 }catch{finish(id);return false;}
 return true;
}
function grant(){if(privacySignal())return;save('granted');removeBanner();send();}
function deny(){
 save('denied');
 // Already-open older site versions must also receive a withdrawal. Grants
 // never flow backward: the expanded v4 notice needs its own explicit choice.
 try{localStorage.setItem(previousConsentKey,'denied');localStorage.setItem(legacyConsentKey,'denied');}catch{}
 stop();removeBanner();
}
function banner(force=false){
 if((status()!=='unset'&&!force)||document.getElementById('mft-analytics-consent'))return;
 const el=document.createElement('aside');el.id='mft-analytics-consent';el.className='mft-analytics-consent';
 el.setAttribute('role','dialog');el.setAttribute('aria-label','Analytics privacy choice');
 const explanation=handoffEndpoint?'Allow M.F.T. to record coded scheduling-link clicks and Google Analytics to count public-page visits and scheduling-button actions, using limited traffic-source and browser information. M.F.T. uses a 30-day retention period for click records, with removal during daily cleanup. Each random event ID prevents duplicate counting and is not sent to Google or SimplePractice.':'Allow Google Analytics to count public-page visits and scheduling-button actions using coded page labels, limited traffic-source information and browser information.';
 el.innerHTML='<p><strong>Optional website analytics</strong><br>'+explanation+' Opening scheduling is not an appointment request or booking. We do not send names, contact details, page text, clinician selections, form entries, appointment details, or client records. Advertising features stay off. You can change this choice using Analytics choices in the footer.</p><div><button type="button" data-choice="deny">Decline</button><button type="button" data-choice="grant">Allow analytics</button></div>';
 if(privacySignal()){el.querySelector('p').textContent='Your browser privacy signal is on. Optional analytics are disabled.';el.querySelector('[data-choice="grant"]').remove();}
 el.addEventListener('click',e=>{if(e.target?.dataset?.choice==='grant')grant();if(e.target?.dataset?.choice==='deny')deny();});
 document.body.appendChild(el);if(force)el.querySelector('button').focus();
}
function setup(){
 const footer=document.querySelector('footer');if(footer){const button=document.createElement('button');button.type='button';button.className='mft-analytics-settings';button.textContent='Analytics choices';button.addEventListener('click',()=>{returnFocus=button;banner(true);});footer.appendChild(button);}
 if(status()==='granted')send();else{stop();if(status()==='unset')banner();}
}
window.MFTAnalyticsConsent={grant,deny,status,show:()=>banner(true)};
window.MFTSchedulingMeasurement={track};
window.addEventListener('storage',e=>{
 if([previousConsentKey,legacyConsentKey].includes(e.key)&&e.newValue==='denied'){deny();return;}
 if(e.key!==consentKey&&e.key!==null)return;
 choice=e.key===consentKey&&e.newValue==='granted'?'granted':'denied';
 if(status()==='granted')send();else{stop();removeBanner();}
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
