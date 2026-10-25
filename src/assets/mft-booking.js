/* Full-page SimplePractice navigation. No vendor loader, iframe or popup. */
(function () {
  'use strict';
  const core = window.MFTBookingCore, config = window.MFT_BOOKING_CONFIG;
  if (!core || !config) return;
  const routeClinician = core.clinicianForPath(config, location.pathname);
  document.querySelectorAll('a[href]').forEach(a => {
    if (a.hasAttribute('data-mft-booking-fallback')) return;
    if (!core.isAppointment(a.href, a.textContent)) return;
    const explicit = config.clinicians.find(c => c.key === a.getAttribute('data-mft-clinician'));
    const clinician = explicit || (a.closest('header, footer') ? null : routeClinician);
    a.removeAttribute('data-spwidget-clinician-id'); a.removeAttribute('data-spwidget-scope-global');
    a.removeAttribute('data-spwidget-autobind'); a.removeAttribute('target');
    a.href = core.destination(config, clinician);
    a.setAttribute('rel', 'noopener noreferrer');
    Object.entries(core.attributes(config, clinician)).forEach(([k,v]) => a.setAttribute(k,v));
    const consultationContext=(a.closest('[data-ui="card"],.option-card')?.textContent||'')+' '+(a.textContent||'');
    if (/free\s*(?:10[- ]minute\s*)?(?:phone\s*)?consultation|10[- ]minute|meet-and-greet|phone introduction/i.test(consultationContext)) a.dataset.mftTenMinuteConsultation='true';
  });
  function placement(a){return a.closest('header')?'header':a.closest('footer')?'footer':a.closest('.mft-consultation-gate')?'dialog':'body';}
  function measure(names,a,done){
    const api=window.MFTSchedulingMeasurement;
    try{if(api&&typeof api.track==='function')return api.track(names,placement(a),done);}catch{}
    if(done)done();return false;
  }
  function handoff(e,a,names){
    if(e.defaultPrevented||e.isTrusted!==true||e.button>1)return;
    if(e.type==='auxclick'||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||a.target==='_blank'){
      measure(names,a);return;
    }
    if(!window.MFTSchedulingMeasurement||window.MFTAnalyticsConsent?.status()!=='granted')return;
    const href=a.href;let completed=false;
    const go=()=>{if(!completed){completed=true;location.assign(href);}};
    e.preventDefault();
    setTimeout(go,2200); // independent fallback even if the analytics module fails
    measure(names,a,go);
  }
  function normalBookingClick(e){
    const a=e.target.closest&&e.target.closest('a[data-mft-booking="true"]');
    if(!a||!core.isAppointment(a.href,a.textContent))return;
    const event=a.dataset.mftTenMinuteConsultation==='true'?'consultation_click':a.hasAttribute('data-spwidget-clinician-id')?'clinician_schedule_click':'appointment_request_click';
    handoff(e,a,[event,'simplepractice_exit']);
  }
  document.addEventListener('click',normalBookingClick);
  document.addEventListener('auxclick',e=>{if(e.button===1)normalBookingClick(e);});
  if (typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal) return;
  const dialog=document.createElement('dialog');
  dialog.className='mft-consultation-gate';
  dialog.setAttribute('aria-labelledby','mft-consultation-title');
  dialog.innerHTML='<form method="dialog"><button class="mft-dialog-close" value="cancel" formnovalidate aria-label="Close">&times;</button><p class="kicker">Before you schedule</p><h2 id="mft-consultation-title">Complimentary 10-minute phone consultation</h2><p>This brief meet-and-greet is available one time for new clients only. It is not a therapy session.</p><label class="mft-consultation-check"><input type="checkbox" required> <span>I understand that the complimentary 10-minute phone consultation is available one time for new clients only and is a brief meet-and-greet, not a therapy session.</span></label><p>Scheduling opens directly on SimplePractice in this tab.</p><div class="actions"><a role="link" class="button primary" data-consultation-continue aria-disabled="true" tabindex="-1" rel="noopener noreferrer">Continue to scheduling</a><button value="cancel" class="button secondary" formnovalidate>Cancel</button></div></form>';
  document.body.appendChild(dialog);
  const check=dialog.querySelector('input'), go=dialog.querySelector('[data-consultation-continue]');
  let destination=null;
  function syncLink() {
    const enabled=Boolean(destination && check.checked);
    go.setAttribute('aria-disabled',String(!enabled));
    go.tabIndex=enabled ? 0 : -1;
    if(enabled)go.href=destination;else go.removeAttribute('href');
  }
  check.addEventListener('change',syncLink);
  dialog.addEventListener('close',()=>{destination=null;check.checked=false;syncLink();});
  document.addEventListener('click',e=>{
    const a=e.target.closest&&e.target.closest('a[data-mft-ten-minute-consultation="true"]');
    if(!a||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
    if(!core.isAppointment(a.href,a.textContent))return;
    const id=a.getAttribute('data-spwidget-clinician-id');
    const clinician=config.clinicians.find(c=>c.id===id)||null;
    destination=core.destination(config,clinician);
    check.checked=false;syncLink();
    try { dialog.showModal(); } catch { destination=null; return; }
    e.preventDefault();e.stopImmediatePropagation();
    if(e.isTrusted===true)measure(['consultation_click'],a);
  },true);
  go.addEventListener('click',e=>{
    if(!destination||!check.checked){e.preventDefault();return;}
    handoff(e,go,['simplepractice_exit']);
  });
  go.addEventListener('auxclick',e=>{
    if(e.button!==1)return;
    if(!destination||!check.checked){e.preventDefault();return;}
    handoff(e,go,['simplepractice_exit']);
  });
})();
