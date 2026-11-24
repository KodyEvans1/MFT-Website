() => {
  const log = (kind, data) => console.log('MFTPROBE ' + JSON.stringify({t: performance.timeOrigin + performance.now(), surface: window.parent === window ? 'parent' : 'helper', kind, data}));
  window.addEventListener('message', event => {
    if (event.data && String(event.data.type).startsWith('mft:')) {
      log('message', {type: event.data.type, id: event.data.id, names: event.data.names});
    }
  });
  if (window.MFTSchedulingMeasurement) {
    const original = window.MFTSchedulingMeasurement.track;
    window.MFTSchedulingMeasurement.track = function (names, placement, done) {
      log('track', {names, placement, consent: window.MFTAnalyticsConsent.status()});
      return original.call(this, names, placement, done);
    };
  }
}
