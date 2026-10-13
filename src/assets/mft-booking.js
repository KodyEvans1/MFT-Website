/* Direct SimplePractice scheduling only. Ops is never a therapy-booking destination. */
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
    a.href = core.destination(config, clinician);
    a.setAttribute('rel', 'noopener noreferrer');
    Object.entries(core.attributes(config, clinician)).forEach(([k,v]) => a.setAttribute(k,v));
    const consultationContext=(a.closest('[data-ui="card"],.option-card')?.textContent||'')+' '+(a.textContent||'');
    if (/free\s*(?:10[- ]minute\s*)?(?:phone\s*)?consultation|10[- ]minute|meet-and-greet|phone introduction/i.test(consultationContext)) a.dataset.mftTenMinuteConsultation='true';
  });

  const dialog=document.createElement('dialog');
  dialog.className='mft-consultation-gate';
  dialog.innerHTML='<form method="dialog"><button class="mft-dialog-close" value="cancel" aria-label="Close">×</button><p class="kicker">Before you schedule</p><h2>Complimentary 10-minute phone consultation</h2><p>This brief meet-and-greet is available one time for new clients only. It is not a therapy session.</p><label class="mft-consultation-check"><input type="checkbox" required> <span>I understand that the complimentary 10-minute phone consultation is available one time for new clients only and is a brief meet-and-greet, not a therapy session.</span></label><div class="actions"><button type="button" class="button primary" data-consultation-continue disabled>Continue to scheduling</button><button value="cancel" class="button secondary">Cancel</button></div></form>';
  document.body.appendChild(dialog);
  const check=dialog.querySelector('input'), go=dialog.querySelector('[data-consultation-continue]');
  let target=null;
  check.addEventListener('change',()=>go.disabled=!check.checked);
  document.addEventListener('click',e=>{
    const a=e.target.closest&&e.target.closest('a[data-mft-ten-minute-consultation="true"]');
    if(!a||a.dataset.mftConsultationApproved==='true')return;
    e.preventDefault();e.stopImmediatePropagation();target=a;check.checked=false;go.disabled=true;dialog.showModal();
  },true);
  go.addEventListener('click',()=>{
    if(!target||!check.checked)return;
    const a=target;target=null;a.dataset.mftConsultationApproved='true';dialog.close();a.click();delete a.dataset.mftConsultationApproved;
  });
})();
