(() => {
  // Test-only observer in the empty helper. It preserves transport arguments
  // and return values and logs event names/counts, never raw payload values.
  if (location.origin !== 'https://www.mft.care') return;
  const surface = location.pathname === '/assets/mft-ga4-frame.html' ? 'helper' : 'parent';
  const approved = new Set(['page_view', 'first_visit', 'session_start', 'user_engagement', 'appointment_request_click', 'clinician_schedule_click', 'consultation_click', 'simplepractice_exit']);
  const log = (kind, data) => console.log('MFTNET ' + JSON.stringify({t: performance.timeOrigin + performance.now(), surface, kind, data}));
  const info = (input, body) => {
    try {
      const url = new URL(typeof input === 'string' ? input : input.url, location.href);
      if (!['www.google-analytics.com', 'region1.google-analytics.com'].includes(url.hostname) || !url.pathname.endsWith('/collect')) return null;
      const query = new URLSearchParams(url.search);
      const records = (typeof body === 'string' ? body.split('\n') : ['']).map(line => {
        const fields = new URLSearchParams(line);
        const name = fields.get('en') || query.get('en');
        return {event: approved.has(name) ? name : name ? 'UNAPPROVED_EVENT' : null, measurementId: fields.get('tid') || query.get('tid'), bodyKeys: [...fields.keys()].sort()};
      });
      return {host: url.hostname, path: url.pathname, bodyType: typeof body, records};
    } catch { return null; }
  };
  log('initial-capabilities', {fetch: typeof window.fetch, sendBeacon: typeof navigator.sendBeacon, xhr: typeof window.XMLHttpRequest});
  window.addEventListener('pagehide', event => log('pagehide', {persisted: event.persisted, visibility: document.visibilityState, fetch: typeof window.fetch}));
  window.addEventListener('beforeunload', () => log('beforeunload', {visibility: document.visibilityState}));
  document.addEventListener('visibilitychange', () => log('visibilitychange', {visibility: document.visibilityState}));
  window.addEventListener('DOMContentLoaded', () => log('ready-capabilities', {fetch: typeof window.fetch, sendBeacon: typeof navigator.sendBeacon, xhr: typeof window.XMLHttpRequest}));
  document.addEventListener('securitypolicyviolation', event => {
    let blockedOrigin = event.blockedURI;
    try { blockedOrigin = new URL(event.blockedURI).origin; } catch { blockedOrigin = ['inline', 'eval', 'self'].includes(blockedOrigin) ? blockedOrigin : 'non-url'; }
    log('securitypolicyviolation', {disposition: event.disposition, effectiveDirective: event.effectiveDirective, blockedOrigin});
  });
  if (surface !== 'helper') return;
  if (typeof navigator.sendBeacon === 'function') {
    const original = navigator.sendBeacon;
    navigator.sendBeacon = function (url, body) {
      const details = info(url, body);
      const result = original.apply(this, arguments);
      if (details) log('sendBeacon', {...details, accepted: result});
      return result;
    };
  }
  if (typeof window.fetch === 'function') {
    const original = window.fetch;
    window.fetch = function (url, options) {
      const details = info(url, options?.body);
      if (details) log('fetch', {...details, keepalive: options?.keepalive === true});
      return original.apply(this, arguments);
    };
  }
  if (window.XMLHttpRequest) {
    const entries = new WeakMap(), open = XMLHttpRequest.prototype.open, send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      entries.set(this, {method, url});
      return open.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function (body) {
      const entry = entries.get(this), details = entry && info(entry.url, body);
      if (details) log('xhr-send', {...details, method: entry.method});
      return send.apply(this, arguments);
    };
  }
})();
