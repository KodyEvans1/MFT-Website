(()=>{'use strict';
const current=document.currentScript;
if(!current||window.__MFT_GA4_BASIC__)return;
const measurementId=current.dataset.mftMeasurementId;
const pageKey=current.dataset.mftPageKey;
if(measurementId!=='G-BTK39BBNRE'||!/^[a-f0-9]{16}$/.test(pageKey||''))return;
window.__MFT_GA4_BASIC__=true;
const consentKey='mft.analytics.consent.v1';
const syntheticLocation='https://www.mft.care/p/'+pageKey+'/';
const genericTitle='M.F.T. Public Website';
let sent=false;

function safeReferrer(){
  try{
    if(!document.referrer)return '';
    const u=new URL(document.referrer);
    return u.protocol==='https:'?u.origin+'/':'';
  }catch{return '';}
}
function status(){try{return localStorage.getItem(consentKey)||'unset';}catch{return 'unset';}}
function save(v){try{localStorage.setItem(consentKey,v);}catch{}}
function removeBanner(){document.getElementById('mft-analytics-consent')?.remove();}
function denyGoogle(){
  if(typeof window.gtag!=='function')return;
  window.gtag('consent','update',{
    analytics_storage:'denied',
    ad_storage:'denied',
    ad_user_data:'denied',
    ad_personalization:'denied'
  });
}
function send(){
  if(sent||status()!=='granted'||typeof window.gtag!=='function')return;
  const gtag=window.gtag;
  gtag('consent','update',{
    analytics_storage:'granted',
    ad_storage:'denied',
    ad_user_data:'denied',
    ad_personalization:'denied'
  });
  gtag('js',new Date());
  gtag('config',measurementId,{
    send_page_view:false,
    page_location:syntheticLocation,
    page_title:genericTitle,
    page_referrer:safeReferrer(),
    allow_google_signals:false,
    allow_ad_personalization_signals:false
  });
  sent=true;
  gtag('event','page_view',{
    send_to:measurementId,
    page_location:syntheticLocation,
    page_title:genericTitle,
    page_referrer:safeReferrer()
  });
}
function grant(){save('granted');removeBanner();send();}
function deny(){save('denied');denyGoogle();removeBanner();}
function banner(){
  if(status()!=='unset'||document.getElementById('mft-analytics-consent'))return;
  const el=document.createElement('aside');
  el.id='mft-analytics-consent';
  el.className='mft-analytics-consent';
  el.setAttribute('role','dialog');
  el.setAttribute('aria-label','Analytics privacy choice');
  el.innerHTML='<p><strong>Optional website analytics</strong><br>Allow basic, privacy-limited Google Analytics so we can understand website traffic. Appointment details, form contents, names, emails, phone numbers and clinical information are not sent.</p><div><button type="button" data-choice="deny">Decline</button><button type="button" data-choice="grant">Allow analytics</button></div>';
  el.addEventListener('click',e=>{const c=e.target?.dataset?.choice;if(c==='grant')grant();if(c==='deny')deny();});
  document.body.appendChild(el);
}
window.MFTAnalyticsConsent={grant,deny,status};
if(status()==='granted')send();
else if(status()==='denied')denyGoogle();
else if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',banner,{once:true});
else banner();
})();