/* Empty-document GA4. Parent interactions and form contents are never forwarded. */
(()=>{'use strict';
const id='G-BTK39BBNRE',origins=['https://www.mft.care','https://mft.care'];
if(window.parent===window)return;
let initialized=false;
window.addEventListener('message',event=>{
 if(initialized||event.source!==window.parent||!origins.includes(event.origin))return;
 const data=event.data;
 if(!data||data.type!=='mft:analytics:pageview'||!/^[a-f0-9]{16}$/.test(data.pageKey||''))return;
 if(navigator.globalPrivacyControl===true||navigator.doNotTrack==='1')return;
 initialized=true;
 const pageLocation='https://www.mft.care/p/'+data.pageKey+'/';
 const referrer=['https://www.google.com/','https://www.bing.com/','https://google.com/','https://bing.com/'].includes(data.referrer)?data.referrer:'';
 window.dataLayer=window.dataLayer||[];
 window.gtag=function(){window.dataLayer.push(arguments);};
 const gtag=window.gtag;
 gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
 gtag('set',{ads_data_redaction:true,allow_google_signals:false,allow_ad_personalization_signals:false,allow_enhanced_conversions:false,send_page_view:false,page_location:pageLocation,page_title:'M.F.T. Public Website',page_referrer:referrer});
 gtag('consent','update',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
 gtag('js',new Date());
 gtag('config',id,{send_page_view:false,page_location:pageLocation,page_title:'M.F.T. Public Website',page_referrer:referrer,allow_google_signals:false,allow_ad_personalization_signals:false,allow_enhanced_conversions:false,user_data:{},cookie_domain:'none',cookie_prefix:'mftga',cookie_flags:'SameSite=Lax;Secure'});
 gtag('event','page_view',{send_to:id,page_location:pageLocation,page_title:'M.F.T. Public Website',page_referrer:referrer});
 const script=document.createElement('script');script.async=true;script.referrerPolicy='no-referrer';script.src='https://www.googletagmanager.com/gtag/js?id='+id;document.head.appendChild(script);
});
})();
