/* Full-page SimplePractice navigation. No vendor loader, iframe or popup. */
(function () {
  'use strict';
  const core = window.MFTBookingCore, config = window.MFT_BOOKING_CONFIG;
  if (!core || !config || window.__MFT_BOOKING__) return; // Static links already work without this enhancement.
  window.__MFT_BOOKING__ = true;
  const routeClinician = core.clinicianForPath(config, location.pathname);
  document.querySelectorAll('a[href]').forEach(a => {
    if (a.hasAttribute('data-mft-booking-fallback')) return;
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
  function measure(names,a){
    // Measurement is optional and cannot cancel, replace, or delay navigation.
    try{window.MFTSchedulingMeasurement?.track(names,placement(a));}catch{}
  }
  function handoff(e,a,names){
    if(e.defaultPrevented||e.isTrusted!==true||e.button>1)return;
    measure(names,a);
  }
  function normalBookingClick(e){
    const a=e.target.closest&&e.target.closest('a[data-mft-booking="true"]');
    if(!a||!core.isAppointment(a.href,a.textContent,a.dataset.mftBookingIntent))return;
    const consultation=a.dataset.mftBookingIntent==='consultation'||(a.dataset.mftBookingIntent!=='appointment'&&(a.dataset.mftTenMinuteConsultation==='true'||a.dataset.mftCouplesConsultation==='true'||/\bconsultation\b/i.test(a.textContent)));
    const event=consultation?'consultation_click':a.hasAttribute('data-spwidget-clinician-id')?'clinician_schedule_click':'appointment_request_click';
    handoff(e,a,[event,'simplepractice_exit']);
  }
  document.addEventListener('click',normalBookingClick);
  document.addEventListener('auxclick',e=>{if(e.button===1)normalBookingClick(e);});
  if (typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal) return;
  const dialog=document.createElement('dialog');
  dialog.className='mft-consultation-gate';
  dialog.setAttribute('aria-labelledby','mft-consultation-title');
  dialog.innerHTML='<form method="dialog"><button class="mft-dialog-close" value="cancel" formnovalidate aria-label="Close">&times;</button><p class="kicker">Before you schedule</p><h2 id="mft-consultation-title">Complimentary 10-minute phone consultation</h2><p>This optional introduction is available to all clients, including individuals and couples. It is not a therapy session or diagnostic evaluation.</p><label class="mft-consultation-check"><input type="checkbox" required> <span>I understand that this optional 10-minute consultation is a brief introduction, not a therapy session. For couples, it does not replace the required 30-minute couples consultation.</span></label><p>Occasionally arranged by telehealth. If technology does not work immediately, this will be a phone call. The call may show Marriage.Family.Therapy or a hidden number. Keep your phone available.</p><p>Scheduling opens directly on SimplePractice in this tab.</p><div class="actions"><a role="link" class="button primary" data-consultation-continue aria-disabled="true" tabindex="-1" rel="noopener noreferrer">Continue to scheduling</a><button value="cancel" class="button secondary" formnovalidate>Cancel</button></div></form>';
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
    if(!core.isAppointment(a.href,a.textContent,a.dataset.mftBookingIntent))return;
    // Recompute from the approved configuration, never from query parameters.
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
    // Otherwise allow the real anchor's native navigation, not a synthetic click.
    handoff(e,go,['simplepractice_exit']);
  });
  go.addEventListener('auxclick',e=>{
    if(e.button!==1)return;
    if(!destination||!check.checked){e.preventDefault();return;}
    handoff(e,go,['simplepractice_exit']);
  });
})();
