/* No GA/Ads tags. Optional first-party measurement never inspects the widget iframe. */
(function () {
  'use strict';
  const core = window.MFTBookingCore, config = window.MFT_BOOKING_CONFIG;
  if (!core || !config) return;
  const routeClinician = core.clinicianForPath(config, location.pathname);
  const buttons = [];
  document.querySelectorAll('a[href]').forEach(a => {
    if (a.hasAttribute('data-mft-booking-fallback')) return;
    if (!core.isAppointment(a.href, a.textContent)) return;
    const explicit = config.clinicians.find(c => c.key === a.getAttribute('data-mft-clinician'));
    const clinician = explicit || (a.closest('header, footer') ? null : routeClinician);
    a.removeAttribute('data-spwidget-clinician-id'); a.removeAttribute('data-spwidget-scope-global');
    a.href = core.destination(config, clinician);
    a.setAttribute('rel', 'noopener noreferrer');
    Object.entries(core.attributes(config, clinician)).forEach(([k,v]) => a.setAttribute(k,v));
    a.dataset.mftPlacement = core.pageCode(location.pathname) + '/b-' + buttons.length;
    buttons.push(a);
  });
  // The vendor loader runs after this deferred script, so new SEO CTAs are also bound.
  if (!core.shouldMeasure(config, location, navigator)) return;
  const CONSENT = 'mft:website-measurement:v1', SESSION = 'mft:acquisition:v1';
  const TTL = 30 * 60 * 1000, CONSENT_TTL = 180 * 86400000;
  const now = () => Date.now();
  let preference = null, state = null;
  const incoming = core.acquisition(location.search, document.referrer, location.origin);
  try {
    const p = JSON.parse(localStorage.getItem(CONSENT) || 'null');
    if (p && ['granted','denied'].includes(p.value) && p.at <= now() && now() - p.at < CONSENT_TTL) preference = p.value;
    else localStorage.removeItem(CONSENT);
  } catch { return; } // Storage unavailable: booking remains functional; no measurement.
  const newId = () => window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : null;
  function persist() { try { sessionStorage.setItem(SESSION, JSON.stringify(state)); return true; } catch { state = null; return false; } }
  function session() {
    if (preference !== 'granted') return false;
    try { state = JSON.parse(sessionStorage.getItem(SESSION) || 'null'); } catch { state = null; }
    const validId = id => typeof id === 'string' && /^[0-9a-f-]{36}$/.test(id);
    if (!state || !validId(state.id) || typeof state.last !== 'number' || state.last > now() || now() - state.last > TTL) {
      const id = newId(); if (!id) return false;
      state = {id, last:now(), acquisition:incoming, landingSent:false};
    }
    // Retain the original source through same-site navigation. Explicit new campaigns reset it.
    else if (incoming.source !== 'direct' && JSON.stringify(state.acquisition) !== JSON.stringify(incoming)) {
      const id = newId(); if (!id) return false;
      state = {id, last:now(), acquisition:incoming, landingSent:false};
    }
    state.acquisition = core.cleanAcquisition(state.acquisition);
    state.last = now();
    return persist();
  }
  function emit(eventType, placement) {
    if (preference !== 'granted' || !state || !core.shouldMeasure(config, location, navigator)) return;
    const eventId = newId(); if (!eventId) return;
    // No email, raw URL, referrer, clinician ID, form field, raw click ID or free text.
    const payload = Object.assign({}, core.cleanAcquisition(state.acquisition), {version:1, consent:'granted', eventId,
      anonymousId:state.id, sessionId:state.id, eventType,
      landingPath:'/website/' + placement});
    try {
      fetch(config.measurementEndpoint, {method:'POST', credentials:'omit', mode:'cors', keepalive:true,
        referrerPolicy:'no-referrer', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)}).catch(() => {});
    } catch { /* Measurement must never prevent scheduling. No background retries. */ }
  }
  function begin() {
    if (!session()) return;
    if (!state.landingSent) { state.landingSent = true; if (persist()) emit('LANDING_VIEW', core.pageCode(location.pathname)); }
  }
  function choose(value) {
    try { localStorage.setItem(CONSENT, JSON.stringify({value,at:now()})); } catch { return; }
    preference = value;
    if (value === 'denied') { state = null; try { sessionStorage.removeItem(SESSION); } catch {} }
    panel.hidden = true;
    if (value === 'granted') begin();
  }
  const panel = document.createElement('section');
  panel.className = 'mft-measurement-panel'; panel.setAttribute('aria-label','Optional website measurement');
  panel.innerHTML = '<h2>Optional website measurement</h2><p>With your permission, M.F.T. stores this visit\'s source, numeric campaign IDs, and scheduling-button clicks in its own Operations system using a random session ID. We do not read what you enter in SimplePractice or send these events to Google Ads. Requesting an appointment works either way.</p><p>Your choice is saved for up to 180 days. Measurement lasts for this browser tab, with a 30-minute inactivity limit. Changing this choice stops future measurement; it does not delete records already received. Contact support@mft.care about existing records.</p><div><button type="button" data-choice="granted">Allow measurement</button><button type="button" data-choice="denied">Decline</button></div>';
  panel.querySelectorAll('button').forEach(b => b.addEventListener('click', () => choose(b.dataset.choice)));
  panel.hidden = preference !== null; document.body.appendChild(panel);
  const settings = document.createElement('button'); settings.type = 'button'; settings.className = 'mft-measurement-settings';
  settings.textContent = 'Website measurement settings'; settings.addEventListener('click', () => { panel.hidden = false; panel.querySelector('button').focus(); });
  (document.querySelector('footer') || document.body).appendChild(settings);
  const lastClicks = new WeakMap();
  document.addEventListener('click', event => {
    const a = event.target.closest && event.target.closest('a[data-mft-booking]');
    if (!a || !event.isTrusted || event.button !== 0 || preference !== 'granted') return;
    const last = lastClicks.get(a) || 0; if (now() - last < 1500) return;
    lastClicks.set(a, now()); if (session()) emit('BOOKING_STARTED', a.dataset.mftPlacement);
  }, true);
  window.addEventListener('storage', event => {
    if (event.key !== CONSENT) return;
    // Re-consent in this tab is required after changes elsewhere; never silently resume.
    preference = null; state = null; try { sessionStorage.removeItem(SESSION); } catch {}
    panel.hidden = false;
  });
  if (preference === 'granted') begin();
  else { try { sessionStorage.removeItem(SESSION); } catch {} }
})();
