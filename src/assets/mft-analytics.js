/* Consent-gated public measurement. Google never runs in the care-page document. */
(()=>{'use strict';
const current=document.currentScript;
if(!current||window.__MFT_GA4_BASIC__)return;
const measurementId=current.dataset.mftMeasurementId,pageKey=current.dataset.mftPageKey;
if(measurementId!=='G-BTK39BBNRE'||!/^[a-f0-9]{16}$/.test(pageKey||'')||!['https://www.mft.care','https://mft.care'].includes(location.origin))return;
window.__MFT_GA4_BASIC__=true;
const consentKey='mft.analytics.consent.v3',legacyConsentKey='mft.analytics.consent.v2';
const sourceKey='mft.analytics.source.v1',frameVersion=current.dataset.mftFrameVersion;
if(!/^[a-f0-9]{16}$/.test(frameVersion||''))return;
const events=new Set(['appointment_request_click','clinician_schedule_click','consultation_click','simplepractice_exit']);
const placements=new Set(['header','footer','body','dialog']);
const campaigns=new Set(['24274542446','24362234053']);
let choice='unset',frame=null,returnFocus=null,measured=false,ready=false,sequence=0;
let queue=[],source=null;
const callbacks=new Map();
try{
 const saved=localStorage.getItem(consentKey);
 if(['granted','denied'].includes(saved))choice=saved;
 // The broader v3 purpose requires a fresh choice. A previous refusal remains a refusal.
 else if(localStorage.getItem(legacyConsentKey)==='denied')choice='denied';
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
 // Read once, only after consent. Never retain/transmit the query, click IDs, free text or URLs.
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
  if(!explicit&&a.source==='direct'&&old&&Number.isFinite(old.expiresAt)&&old.expiresAt>Date.now()&&old.expiresAt<=Date.now()+1800000)a=cleanSource(old);
 }catch{}
 a=cleanSource(a);
 try{sessionStorage.setItem(sourceKey,JSON.stringify({...a,expiresAt:Date.now()+1800000}));}catch{}
 return a;
}
function removeBanner(){document.getElementById('mft-analytics-consent')?.remove();returnFocus?.focus();returnFocus=null;}
function clearCookies(){
 for(const part of document.cookie.split(';')){const name=part.split('=')[0].trim();if(/^mftga_/.test(name))document.cookie=name+'=; Max-Age=0; Path=/; SameSite=Lax; Secure';}
}
function finish(id){const done=callbacks.get(id);if(done){callbacks.delete(id);done();}}
function stop(){
 if(frame){try{frame.contentWindow['ga-disable-'+measurementId]=true;}catch{}frame.remove();frame=null;}
 ready=false;queue=[];source=null;
 try{sessionStorage.removeItem(sourceKey);}catch{}
 clearCookies();
 for(const id of [...callbacks.keys()])finish(id);
}
function post(message){if(frame&&ready&&status()==='granted')frame.contentWindow.postMessage(message,location.origin);}
function send(){
 if(frame||status()!=='granted')return;
 source=acquisition();
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
  post({type:'mft:analytics:init',pageKey,referrer:safeReferrer(),source:cleanSource(source),sendPageView:!measured});
  for(const item of queue)post(item);
  queue=[];
 }
});
function track(names,placement,done){
 const requested=Array.isArray(names)?names:[];
 const allowed=[...new Set(requested)].filter(name=>events.has(name));
 if(status()!=='granted'||!allowed.length||!placements.has(placement)){if(typeof done==='function')done();return false;}
 const id='m'+(++sequence);
 if(typeof done==='function'){
  let completed=false;
  callbacks.set(id,()=>{if(!completed){completed=true;done();}});
  // Navigation is never dependent on Google, a frame response, or a successful request.
  setTimeout(()=>finish(id),250);
 }
 try{
  send();
  const item={type:'mft:analytics:intent',id,names:allowed,placement};
  if(ready)post(item);else if(queue.length<8)queue.push(item);else finish(id);
 }catch{finish(id);return false;}
 return true;
}
function grant(){if(privacySignal())return;save('granted');removeBanner();send();}
function deny(){save('denied');stop();removeBanner();}
function banner(force=false){
 if((status()!=='unset'&&!force)||document.getElementById('mft-analytics-consent'))return;
 const el=document.createElement('aside');el.id='mft-analytics-consent';el.className='mft-analytics-consent';
 el.setAttribute('role','dialog');el.setAttribute('aria-label','Analytics privacy choice');
 el.innerHTML='<p><strong>Optional website analytics</strong><br>Allow Google Analytics to count public-page visits and scheduling-button actions using coded page labels, limited traffic-source information and browser information. Opening scheduling is not a booking. We do not send page text, clinician selections, form entries, appointment details, or client records. Advertising features stay off. You can change this choice using Analytics choices in the footer.</p><div><button type="button" data-choice="deny">Decline</button><button type="button" data-choice="grant">Allow analytics</button></div>';
 if(privacySignal()){el.querySelector('p').textContent='Your browser privacy signal is on. Optional analytics are disabled.';el.querySelector('[data-choice="grant"]').remove();}
 el.addEventListener('click',e=>{if(e.target?.dataset?.choice==='grant')grant();if(e.target?.dataset?.choice==='deny')deny();});
 document.body.appendChild(el);if(force)el.querySelector('button').focus();
}
function setup(){
 const footer=document.querySelector('footer');if(footer){const button=document.createElement('button');button.type='button';button.className='mft-analytics-settings';button.textContent='Analytics choices';button.addEventListener('click',()=>{returnFocus=button;banner(true);});footer.appendChild(button);}
 if(status()==='granted')send();else if(status()==='unset')banner();else stop();
}
window.MFTAnalyticsConsent={grant,deny,status,show:()=>banner(true)};
window.MFTSchedulingMeasurement={track};
window.addEventListener('storage',e=>{if(e.key!==consentKey)return;choice=e.newValue==='granted'?'granted':'denied';if(status()==='granted')send();else{stop();removeBanner();}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
