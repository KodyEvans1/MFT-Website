/* Empty-document GA4. Only reviewed scalar fields cross the parent/frame boundary. */
(()=>{'use strict';
const id='G-BTK39BBNRE',origins=['https://www.mft.care','https://mft.care'];
if(window.parent===window||!origins.includes(location.origin))return;
const names=new Set(['appointment_request_click','clinician_schedule_click','consultation_click','simplepractice_exit']);
const placements=new Set(['header','footer','body','dialog']);
const campaigns=new Set(['24274542446','24362234053']);
let initialized=false,pageLocation='',referrer='',pending=0,source={};
const seen=new Set();
function acknowledge(type,extra={}){window.parent.postMessage({type,...extra},location.origin);}
function sanitizedSource(a){
 if(!a||typeof a!=='object')return {};
 const out={};
 if(['google/cpc','google/organic','bing/organic','referral/referral','other/unknown','unknown/unknown'].includes(a.source+'/'+a.medium)){
  out.campaign_source=a.source;out.campaign_medium=a.medium;
 }
 if(a.source==='google'&&a.medium==='cpc'){
  out.campaign_name='mft-search';
  if(campaigns.has(a.campaignId))out.campaign_id=a.campaignId;
 }
 return out;
}
function emit(name,extra,done){
 pending++;window['ga-disable-'+id]=false;
 let finished=false;
 const complete=()=>{if(finished)return;finished=true;pending--;if(pending===0)window['ga-disable-'+id]=true;if(done)done();};
 window.gtag('event',name,{send_to:id,page_location:pageLocation,page_title:'M.F.T. Public Website',page_referrer:referrer,...source,...extra,transport_type:'beacon',event_callback:complete,event_timeout:2000});
 // A blocked tag must not leave future automatic activity enabled indefinitely.
 setTimeout(complete,2200);
}
window.addEventListener('message',event=>{
 if(event.source!==window.parent||!origins.includes(event.origin)||event.origin!==location.origin)return;
 if(navigator.globalPrivacyControl===true||navigator.doNotTrack==='1')return;
 const data=event.data;
 if(!data||typeof data!=='object')return;
 if(data.type==='mft:analytics:init'){
  if(initialized||!/^[a-f0-9]{16}$/.test(data.pageKey||''))return;
  initialized=true;
  pageLocation='https://www.mft.care/p/'+data.pageKey+'/';
  referrer=['https://www.google.com/','https://www.bing.com/','https://google.com/','https://bing.com/'].includes(data.referrer)?data.referrer:'';
  source=sanitizedSource(data.source);
  window.dataLayer=window.dataLayer||[];
  window.gtag=function(){window.dataLayer.push(arguments);};
  const gtag=window.gtag;
  gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
  gtag('set',{ads_data_redaction:true,allow_google_signals:false,allow_ad_personalization_signals:false,allow_enhanced_conversions:false,send_page_view:false,page_location:pageLocation,page_title:'M.F.T. Public Website',page_referrer:referrer,...source});
  gtag('consent','update',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
  gtag('js',new Date());
  gtag('config',id,{send_page_view:false,page_location:pageLocation,page_title:'M.F.T. Public Website',page_referrer:referrer,...source,allow_google_signals:false,allow_ad_personalization_signals:false,allow_enhanced_conversions:false,user_data:{},cookie_domain:'none',cookie_prefix:'mftga',cookie_flags:'SameSite=Lax;Secure'});
  if(data.sendPageView!==false)emit('page_view',{},()=>acknowledge('mft:analytics:complete'));
  else window['ga-disable-'+id]=true;
  const script=document.createElement('script');script.async=true;script.referrerPolicy='no-referrer';script.src='https://www.googletagmanager.com/gtag/js?id='+id;document.head.appendChild(script);
  return;
 }
 if(!initialized||data.type!=='mft:analytics:intent'||!/^m[1-9][0-9]{0,6}$/.test(data.id||'')||seen.has(data.id)||seen.size>=100||!placements.has(data.placement)||!Array.isArray(data.names)||data.names.length>4)return;
 const approved=[...new Set(data.names)].filter(name=>names.has(name));
 if(!approved.length)return;
 seen.add(data.id);
 let remaining=approved.length;
 for(const name of approved)emit(name,{button_location:data.placement,measurement_kind:'scheduling_intent'},()=>{if(--remaining===0)acknowledge('mft:analytics:ack',{id:data.id});});
});
window.parent.postMessage({type:'mft:analytics:ready'},location.origin);
})();
