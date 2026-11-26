/* Native SimplePractice links with one optional, accessible scheduling dialog. */
(function () {
  'use strict';
  const core = window.MFTBookingCore, config = window.MFT_BOOKING_CONFIG;
  if (!core || !config || window.__MFT_BOOKING__) return; // Static links already work without this enhancement.
  window.__MFT_BOOKING__ = true;
  const routeClinician = core.clinicianForPath(config, location.pathname);
  document.querySelectorAll('a[href]').forEach(a => {
    if (a.hasAttribute('data-mft-booking-fallback') || a.dataset.mftExistingClient === 'true') return;
    if (!core.isAppointment(a.href, a.textContent, a.dataset.mftBookingIntent)) return;
    const explicit = config.clinicians.find(c => c.key === a.getAttribute('data-mft-clinician'));
    const clinician = explicit || (a.closest('header, footer') ? null : routeClinician);
    a.removeAttribute('data-spwidget-clinician-id'); a.removeAttribute('data-spwidget-scope-global');
    a.removeAttribute('data-spwidget-autobind'); a.removeAttribute('target');
    a.href = core.destination(config, clinician);
    a.setAttribute('rel', 'noopener noreferrer');
    Object.entries(core.attributes(config, clinician)).forEach(([k,v]) => a.setAttribute(k,v));
    const consultationContext=(a.closest('[data-ui="card"],.option-card')?.textContent||'')+' '+(a.textContent||'');
    if (a.dataset.mftBookingIntent!=='appointment'&&/free\s*(?:10[- ]minute\s*)?(?:phone\s*)?consultation|10[- ]minute|meet-and-greet|phone introduction/i.test(consultationContext)) a.dataset.mftTenMinuteConsultation='true';
  });
  function placement(a){return a.closest('header')?'header':a.closest('footer')?'footer':a.closest('.mft-consultation-gate')?'dialog':'body';}
  function genericHandoff(a,url=a.href){
    // This local boolean is the only booking detail offered to the conditional
    // Google bridge. A clinician consultation can share the generic event name.
    return url==='https://marriagefamilytherapy.clientsecure.me/request'&&
      !a.hasAttribute('data-mft-clinician')&&!a.hasAttribute('data-spwidget-clinician-id');
  }
  function measure(names,a,googleGenericHandoff=false){
    // Measurement is optional and cannot cancel, replace, or delay navigation.
    try{window.MFTSchedulingMeasurement?.track(names,placement(a),undefined,{googleGenericHandoff});}catch{}
  }
  // Repeated activations during one visible visit share a native handoff. A
  // demonstrated hidden-to-visible return permits a new deliberate activation;
  // a background new tab, focus alone or elapsed time does not reset the set.
  // This state never leaves the page or prevents the anchor's default action.
  let completedNativeLinks=new WeakSet();
  let nativeDocumentHidden=false;
  function newNativeVisit(){completedNativeLinks=new WeakSet();nativeDocumentHidden=false;}
  window.addEventListener('pageshow',e=>{if(e.persisted)newNativeVisit();});
  document.addEventListener('visibilitychange',e=>{
    if(e.isTrusted!==true)return;
    if(document.visibilityState==='hidden')nativeDocumentHidden=true;
    else if(document.visibilityState==='visible'&&nativeDocumentHidden)newNativeVisit();
  });
  function handoff(e,a,names,googleGenericHandoff=genericHandoff(a),deduplicateNative=false){
    if(e.defaultPrevented||e.isTrusted!==true||e.button>1)return;
    if(deduplicateNative){
      if(completedNativeLinks.has(a))return;
      completedNativeLinks.add(a);
    }
    measure(names,a,googleGenericHandoff);
  }
  function bookingLink(e){
    const a=e.target.closest&&e.target.closest('a[data-mft-booking="true"]');
    return a&&a.dataset.mftExistingClient!=='true'&&core.isAppointment(a.href,a.textContent,a.dataset.mftBookingIntent)?a:null;
  }
  function diagnostic(a){
    const consultation=a.dataset.mftBookingIntent==='consultation'||(a.dataset.mftBookingIntent!=='appointment'&&(a.dataset.mftTenMinuteConsultation==='true'||a.dataset.mftCouplesConsultation==='true'||/\bconsultation\b/i.test(a.textContent)));
    return consultation?'consultation_click':a.hasAttribute('data-spwidget-clinician-id')?'clinician_schedule_click':'appointment_request_click';
  }
  function normalBookingClick(e){
    const a=bookingLink(e);
    if(a)handoff(e,a,[diagnostic(a),'simplepractice_exit'],genericHandoff(a),true);
  }
  document.addEventListener('click',normalBookingClick);
  document.addEventListener('auxclick',e=>{if(e.button===1)normalBookingClick(e);});
  if (typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal) return;
  const dialog=document.createElement('dialog');
  dialog.className='mft-consultation-gate';
  dialog.setAttribute('aria-labelledby','mft-consultation-title');
  // Runtime markup keeps intake controls out of the public page/analytics inventory.
  // This acknowledgment is not identity verification or consent to treatment.
  dialog.innerHTML=`<form method="dialog">
    <button type="button" class="mft-dialog-close" value="cancel" formnovalidate aria-label="Close">&times;</button>
    <p class="kicker">Before you schedule</p>
    <h2 id="mft-consultation-title" tabindex="-1" autofocus>Before you request an appointment</h2>
    <section data-mft-account-section aria-label="Your account and information">
      <p>Create an account only for yourself. Use your own name and contact information. Do not create an account or complete consent forms as another person.</p>
      <p>For couples care, you may start a request if you will participate; each person completes their own account and consent steps.</p>
      <aside class="mft-booking-help" aria-labelledby="mft-booking-help-title">
        <h3 id="mft-booking-help-title">Children and help with signing up</h3>
        <p>In Washington, adolescents ages 13–17 may request outpatient behavioral health care without parental consent.</p>
        <p>If you are requesting care for a child or someone you legally represent, contact M.F.T. so we can confirm the appropriate consent and account setup. Do not create an account as that person.</p>
        <p>If you feel pressured or unsafe, or need help with privacy, contact our office before using the portal.</p>
        <p><a href="tel:+14256590654">Call (425) 659-0654</a> or <a href="/therapy-contact-woodinville/">contact M.F.T.</a>.</p>
      </aside>
      <label class="mft-consultation-check"><input type="checkbox" data-mft-account-ack> <span>I am requesting care for myself, including couples care in which I will participate. I am responsible for the accuracy of the information I provide about myself and will complete only my own consent forms.</span></label>
      <p class="mft-booking-note">When possible, we’ll remember this acknowledgment in this browser. This is not consent to treatment.</p>
    </section>
    <section data-mft-consultation-section aria-labelledby="mft-consultation-detail-title">
      <h3 id="mft-consultation-detail-title">Complimentary 10-minute phone consultation</h3>
      <p>This optional introduction is available to all clients, including individuals and couples. It is not a therapy session or diagnostic evaluation.</p>
      <label class="mft-consultation-check"><input type="checkbox" data-mft-consultation-ack> <span>I understand that this optional 10-minute consultation is a brief introduction, not a therapy session. For couples, it does not replace the required 30-minute couples consultation.</span></label>
      <p>Occasionally arranged by telehealth. If technology does not work immediately, this will be a phone call. The call may show Marriage.Family.Therapy or a hidden number. Keep your phone available.</p>
    </section>
    <p class="mft-booking-note">Scheduling opens directly on SimplePractice in this tab.</p>
    <div class="actions"><a role="link" class="button primary" data-consultation-continue aria-disabled="true" tabindex="-1" rel="noopener noreferrer">Continue to SimplePractice</a><button type="button" value="cancel" class="button secondary" formnovalidate>Cancel</button></div>
  </form>`;
  document.body.appendChild(dialog);
  const account=dialog.querySelector('[data-mft-account-ack]');
  const consultation=dialog.querySelector('[data-mft-consultation-ack]');
  const accountSection=dialog.querySelector('[data-mft-account-section]');
  const consultationSection=dialog.querySelector('[data-mft-consultation-section]');
  const title=dialog.querySelector('h2'),go=dialog.querySelector('[data-consultation-continue]');
  // A functional preference, separate from analytics consent. No personal data.
  // Bump the version when the account acknowledgment materially changes.
  const ACK_KEY='mft.newClientAccountAcknowledgment.v1',ACK_VALUE='acknowledged';
  let memoryAcknowledged=false,pending=null,destination=null;
  function acknowledged(){
    if(memoryAcknowledged)return true;
    try{return localStorage.getItem(ACK_KEY)===ACK_VALUE;}catch{return false;}
  }
  function remember(){
    memoryAcknowledged=true;
    try{localStorage.setItem(ACK_KEY,ACK_VALUE);}catch{}
  }
  function ready(){
    return Boolean(pending&&(!pending.account||account.checked)&&(!pending.consultation||consultation.checked));
  }
  function syncLink() {
    const enabled=Boolean(destination&&ready());
    go.setAttribute('aria-disabled',String(!enabled));
    go.tabIndex=enabled ? 0 : -1;
    if(enabled)go.href=destination;else go.removeAttribute('href');
  }
  account.addEventListener('change',syncLink);
  consultation.addEventListener('change',syncLink);

  // A visible analytics prompt must not compete with the scheduling dialog.
  // Preserve its exact state and handle banners created after scheduling opens.
  // This never reads or changes analytics consent or measurement settings.
  const suspendedBanners=new Map();
  function suspendBanner(){
    const banner=document.getElementById('mft-analytics-consent');
    if(!banner||suspendedBanners.has(banner))return;
    suspendedBanners.set(banner,{hidden:banner.hidden,inert:banner.inert,aria:banner.getAttribute('aria-hidden')});
    banner.hidden=true;banner.inert=true;banner.setAttribute('aria-hidden','true');
  }
  const observer=typeof MutationObserver==='function'?new MutationObserver(()=>{if(dialog.open)suspendBanner();}):null;
  function suspendPrompts(){
    document.documentElement.classList.add('mft-scheduling-dialog-open');
    suspendBanner();observer?.observe(document.body,{childList:true,subtree:true});
  }
  function restorePrompts(){
    observer?.disconnect();
    for(const [banner,state] of suspendedBanners){
      banner.hidden=state.hidden;banner.inert=state.inert;
      if(state.aria===null)banner.removeAttribute('aria-hidden');else banner.setAttribute('aria-hidden',state.aria);
    }
    suspendedBanners.clear();
    document.documentElement.classList.remove('mft-scheduling-dialog-open');
  }
  function reset(){
    const initiator=pending?.initiator;
    pending=null;destination=null;account.checked=false;consultation.checked=false;syncLink();
    restorePrompts();
    if(initiator?.isConnected)initiator.focus({preventScroll:true});
  }
  dialog.addEventListener('close',()=>{if(!dialog.open)reset();});
  // Let the native dialog handle Escape without also closing a background menu.
  dialog.addEventListener('keydown',e=>{if(e.key==='Escape')e.stopPropagation();});
  dialog.querySelector('form').addEventListener('submit',e=>e.preventDefault());
  dialog.querySelectorAll('button[value="cancel"]').forEach(button=>button.addEventListener('click',()=>dialog.close()));
  function openGate(e){
    if(e.defaultPrevented||e.isTrusted!==true||(e.type==='auxclick'?e.button!==1:e.button!==0))return;
    const a=bookingLink(e);
    if(!a||dialog.contains(a)||dialog.open)return;
    const needsAccount=!acknowledged(),needsConsultation=a.dataset.mftTenMinuteConsultation==='true';
    if(!needsAccount&&!needsConsultation)return;
    // Recompute from the approved configuration, never from query parameters.
    const id=a.getAttribute('data-spwidget-clinician-id');
    const clinician=config.clinicians.find(c=>c.id===id)||null;
    destination=core.destination(config,clinician);
    pending={initiator:a,account:needsAccount,consultation:needsConsultation,event:diagnostic(a),googleGenericHandoff:genericHandoff(a,destination),completed:false};
    accountSection.hidden=!needsAccount;account.required=needsAccount;account.checked=false;
    consultationSection.hidden=!needsConsultation;consultation.required=needsConsultation;consultation.checked=false;
    title.textContent=needsAccount?'Before you request an appointment':'Complimentary 10-minute phone consultation';
    syncLink();
    try{suspendPrompts();dialog.showModal();dialog.scrollTop=0;}catch{reset();return;}
    e.preventDefault();e.stopImmediatePropagation();
    if(needsConsultation)measure(['consultation_click'],a);
  }
  // Capture first so merely opening the dialog cannot count as a handoff.
  document.addEventListener('click',openGate,true);
  document.addEventListener('auxclick',openGate,true);
  function continueBooking(e){
    if(e.type==='auxclick'&&e.button!==1)return;
    if(!destination||!ready()){e.preventDefault();return;}
    if(e.defaultPrevented||e.isTrusted!==true||e.button>1||pending.completed)return;
    pending.completed=true;
    if(pending.account)remember();
    handoff(e,go,pending.consultation?['simplepractice_exit']:[pending.event,'simplepractice_exit'],pending.googleGenericHandoff&&go.href===destination);
    // Keep href intact through the native default action, including new-tab clicks.
    // Close on the next task; pageshow also cleans up a BFCache-restored dialog.
    setTimeout(()=>{if(dialog.open&&pending?.completed)dialog.close();},0);
  }
  go.addEventListener('click',continueBooking);
  go.addEventListener('auxclick',continueBooking);
  window.addEventListener('pageshow',()=>{if(dialog.open&&pending?.completed)dialog.close();});
})();
