(() => {
  // Test-only observation preserves arguments/return values. It emits field
  // names and transport flags, never IDs, source values, URLs or body values.
  if (location.origin !== 'https://www.mft.care') return;
  const log = (kind, data) => console.log('MFTNET ' + JSON.stringify({
    t: performance.timeOrigin + performance.now(), surface: 'parent', kind, data
  }));
  window.addEventListener('pagehide', event => log('pagehide', {persisted: event.persisted}));
  if (typeof window.fetch !== 'function') return;
  const original = window.fetch;
  window.fetch = function (input, options) {
    try {
      const url = new URL(typeof input === 'string' ? input : input.url, location.href);
      if (url.href === 'https://ops.mft.care/api/marketing/attribution') {
        const body = JSON.parse(options?.body || '{}');
        log('fetch', {
          event: body.eventType === 'simplepractice_exit' ? body.eventType : 'UNAPPROVED_EVENT',
          fieldNames: Object.keys(body).sort(), keepalive: options?.keepalive === true,
          credentials: options?.credentials, referrerPolicy: options?.referrerPolicy
        });
      }
    } catch {
      log('unparseable-test-request', {});
    }
    return original.apply(this, arguments);
  };
})();
