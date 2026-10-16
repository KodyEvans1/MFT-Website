/* Consent controller only. Google runs in an empty measurement document, not the care page. */
(()=>{'use strict';
const current=document.currentScript;
if(!current||window.__MFT_GA4_BASIC__)return;
const measurementId=current.dataset.mftMeasurementId,pageKey=current.dataset.mftPageKey;
if(measurementId!=='G-BTK39BBNRE'||!/^[a-f0-9]{16}$/.test(pageKey||'')||!['https://www.mft.care','https://mft.care'].includes(location.origin))return;
window.__MFT_GA4_BASIC__=true;
const consentKey='mft.analytics.consent.v2',frameVersion=current.dataset.mftFrameVersion;
if(!/^[a-f0-9]{16}$/.test(frameVersion||''))return;
let choice='unset',frame=null,returnFocus=null,measured=false;
try{const saved=localStorage.getItem(consentKey);if(['granted','denied'].includes(saved))choice=saved;}catch{}
function privacySignal(){return navigator.globalPrivacyControl===true||navigator.doNotTrack==='1';}
function status(){return privacySignal()?'denied':choice;}
function save(value){choice=value;try{localStorage.setItem(consentKey,value);}catch{}}
function safeReferrer(){
 try{const u=new URL(document.referrer);return ['https://www.google.com','https://www.bing.com','https://google.com','https://bing.com'].includes(u.origin)?u.origin+'/':'';}catch{return '';}
}
function removeBanner(){document.getElementById('mft-analytics-consent')?.remove();returnFocus?.focus();returnFocus=null;}
function clearCookies(){
 for(const part of document.cookie.split(';')){const name=part.split('=')[0].trim();if(/^mftga_/.test(name))document.cookie=name+'=; Max-Age=0; Path=/; SameSite=Lax; Secure';}
}
function stop(){
 if(frame){try{frame.contentWindow['ga-disable-'+measurementId]=true;}catch{}frame.remove();frame=null;}
 clearCookies();
}
function send(){
 if(frame||measured||status()!=='granted')return;
 frame=document.createElement('iframe');frame.hidden=true;frame.title='Optional website traffic measurement';
 frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;frame.referrerPolicy='no-referrer';
 frame.src='/assets/mft-ga4-frame.html?v='+frameVersion;
 document.body.appendChild(frame);
}
window.addEventListener('message',event=>{
 if(!frame||status()!=='granted'||event.source!==frame.contentWindow||event.origin!==location.origin)return;
 if(event.data?.type==='mft:analytics:complete'){measured=true;frame.remove();frame=null;return;}
 if(event.data?.type==='mft:analytics:ready')frame.contentWindow.postMessage({type:'mft:analytics:pageview',pageKey,referrer:safeReferrer()},location.origin);
});
function grant(){if(privacySignal())return;save('granted');removeBanner();send();}
function deny(){save('denied');stop();removeBanner();}
function banner(force=false){
 if((status()!=='unset'&&!force)||document.getElementById('mft-analytics-consent'))return;
 const el=document.createElement('aside');el.id='mft-analytics-consent';el.className='mft-analytics-consent';
 el.setAttribute('role','dialog');el.setAttribute('aria-label','Analytics privacy choice');
 el.innerHTML='<p><strong>Optional website analytics</strong><br>Allow Google Analytics to count visits to public pages using coded page labels and browser information. We do not send page text, form entries, appointment details, or client records. Advertising features stay off. You can change this choice using Analytics choices in the footer.</p><div><button type="button" data-choice="deny">Decline</button><button type="button" data-choice="grant">Allow analytics</button></div>';
 if(privacySignal()){el.querySelector('p').textContent='Your browser privacy signal is on. Optional analytics are disabled.';el.querySelector('[data-choice="grant"]').remove();}
 el.addEventListener('click',e=>{if(e.target?.dataset?.choice==='grant')grant();if(e.target?.dataset?.choice==='deny')deny();});
 document.body.appendChild(el);if(force)el.querySelector('button').focus();
}
function setup(){
 const footer=document.querySelector('footer');if(footer){const button=document.createElement('button');button.type='button';button.className='mft-analytics-settings';button.textContent='Analytics choices';button.addEventListener('click',()=>{returnFocus=button;banner(true);});footer.appendChild(button);}
 if(status()==='granted')send();else if(status()==='unset')banner();else stop();
}
window.MFTAnalyticsConsent={grant,deny,status,show:()=>banner(true)};
window.addEventListener('storage',e=>{if(e.key!==consentKey)return;choice=e.newValue==='granted'?'granted':'denied';if(status()==='granted')send();else{stop();removeBanner();}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
