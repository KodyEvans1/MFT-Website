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
let sent=false,loading=false;

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
function load(){
  if(sent||loading||status()!=='granted')return;
  loading=true;
  window.dataLayer=window.dataLayer||[];
  window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};
  const gtag=window.gtag;
  gtag('js',new Date());
  gtag('config',measurementId,{
    send_page_view:false,
    page_location:syntheticLocation,
    page_title:genericTitle,
    page_referrer:safeReferrer(),
    allow_google_signals:false,
    allow_ad_personalization_signals:false
  });
  const s=document.createElement('script');
  s.async=true;
  s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(measurementId);
  s.referrerPolicy='no-referrer';
  s.onload=()=>{
    if(sent)return;
    sent=true;
    gtag('event','page_view',{
      send_to:measurementId,
      page_location:syntheticLocation,
      page_title:genericTitle,
      page_referrer:safeReferrer()
    });
  };
  s.onerror=()=>{loading=false;};
  document.head.appendChild(s);
}
function grant(){save('granted');removeBanner();load();}
function deny(){save('denied');removeBanner();}
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
if(status()==='granted')load();else if(status()==='unset'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',banner,{once:true});else banner();}
})();