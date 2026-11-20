() => {
  const log = (kind, data) => console.log('MFTPROBE ' + JSON.stringify({t: performance.timeOrigin + performance.now(), surface: window.parent === window ? 'parent' : 'helper', kind, data}));
  window.addEventListener('message', event => {
    if (event.data && String(event.data.type).startsWith('mft:')) {
      log('message', {type: event.data.type, id: event.data.id, names: event.data.names});
    }
  });
  if (window.gtag) {
    const original = window.gtag;
    window.gtag = function () {
      const args = Array.from(arguments);
      log('gtag', {command: args[0], name: args[1], disabled: window['ga-disable-G-BTK39BBNRE'] === true});
      if (args[0] === 'event' && args[2]?.event_callback) {
        const callback = args[2].event_callback;
        args[2] = {...args[2], event_callback: () => {log('callback', args[1]); callback();}};
      }
      return original.apply(this, args);
    };
  }
  if (window.MFTSchedulingMeasurement) {
    const original = window.MFTSchedulingMeasurement.track;
    window.MFTSchedulingMeasurement.track = function (names, placement, done) {
      log('track', {names, placement, consent: window.MFTAnalyticsConsent.status()});
      return original.call(this, names, placement, done);
    };
  }
}
