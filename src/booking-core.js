/* Shared by the static build, browser and regressions. No network or storage. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MFTBookingCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const normalizePath = p => { const s = String(p || '').split(/[?#]/)[0].replace(/^\/+|\/+$/g, ''); return s ? '/' + s + '/' : '/'; };
  function clinicianForPath(config, pathname) {
    return config.clinicians.find(c => normalizePath(pathname) === '/' + c.slug + '/') || null;
  }
  function destination(config, clinician) {
    if (!clinician) return config.generalUrl;
    if (!config.clinicians.some(c => c.id === clinician.id)) throw new Error('Unknown booking clinician');
    const u = new URL('https://clientsecure.me/widget-redirect');
    for (const [k, v] of Object.entries({scopeId: config.scopeId, applicationId: config.applicationId,
      channel: 'professional_website', appearance: JSON.stringify({fullScreen: true}), clinicianId: clinician.id})) u.searchParams.set(k, v);
    return u.toString();
  }
  function attributes(config, clinician) {
    const out = {'data-mft-booking':'true', 'data-spwidget-scope-id':config.scopeId,
      'data-spwidget-scope-uri':config.scopeUri, 'data-spwidget-application-id':config.applicationId,
      'data-spwidget-type':'OAR', 'data-spwidget-autobind':''};
    out[clinician ? 'data-spwidget-clinician-id' : 'data-spwidget-scope-global'] = clinician ? clinician.id : '';
    return out;
  }
  function isAppointment(href, label) {
    if (/existing client|client portal|staff|insurance|benefits|assessment|marriage\.reset/i.test(label)) return false;
    if (!/request|schedule|consultation|appointment|initial session/i.test(label)) return false;
    try {
      const u = new URL(href);
      return (u.origin === 'https://marriagefamilytherapy.clientsecure.me' && u.pathname === '/') ||
        (u.origin === 'https://clientsecure.me' && u.pathname === '/widget-redirect');
    } catch { return false; }
  }
  const paidMedium = m => ['cpc','ppc','paid_search','paidsearch'].includes(m);
  function acquisition(search, referrer, ownOrigin) {
    const q = new URLSearchParams(search || '');
    const source = (q.get('utm_source') || '').toLowerCase();
    const medium = (q.get('utm_medium') || '').toLowerCase();
    const click = ['gclid','gbraid','wbraid'].some(k => /^[A-Za-z0-9_~-]{1,255}$/.test(q.get(k) || ''));
    const ids = {campaignId:null, adGroupId:null, creativeId:null, network:null, device:null};
    let detected = {source:'direct', medium:'none'};
    if (click || (source === 'google' && paidMedium(medium))) detected = {source:'google',medium:'cpc'};
    else if (['google','bing'].includes(source) && medium === 'organic') detected = {source, medium:'organic'};
    else if (source === 'bing' && paidMedium(medium)) detected = {source:'bing', medium:'cpc'};
    else if (source === 'google') detected = {source:'google', medium:'unknown'};
    else if (source) detected = {source:'other', medium:'unknown'};
    else if (referrer) {
      try {
        const r = new URL(referrer), h = r.hostname.toLowerCase();
        if (r.origin === ownOrigin || ['www.mft.care','mft.care'].includes(h)) detected = {source:'direct', medium:'none'};
        else if (['google.com','google.ca','google.co.uk'].some(d => h === d || h.endsWith('.' + d))) detected = {source:'google', medium:'organic'};
        else if (h === 'bing.com' || h.endsWith('.bing.com')) detected = {source:'bing', medium:'organic'};
        else detected = {source:'referral', medium:'referral'};
      } catch { detected = {source:'unknown', medium:'unknown'}; }
    }
    // Campaign joins use numeric IDs, never free-text campaign names or search terms.
    if (detected.source === 'google' && detected.medium === 'cpc') {
      for (const [field, key] of [['campaignId','utm_campaign_id'],['adGroupId','utm_adgroup_id'],['creativeId','utm_creative_id']]) {
        const v = q.get(key); if (/^[0-9]{1,30}$/.test(v || '')) ids[field] = v;
      }
      if (['g','s','d'].includes(q.get('utm_network'))) ids.network = q.get('utm_network');
      if (['c','m','t'].includes(q.get('utm_device'))) ids.device = q.get('utm_device');
    }
    return Object.assign(detected, ids);
  }

  function cleanAcquisition(value) {
    const a = value && typeof value === 'object' ? value : {};
    const pairs = ['google/cpc','google/organic','google/unknown','bing/cpc','bing/organic','direct/none','referral/referral','unknown/unknown','other/unknown'];
    const pair = pairs.includes(a.source + '/' + a.medium) ? [a.source,a.medium] : ['unknown','unknown'];
    const out = {source:pair[0],medium:pair[1],campaignId:null,adGroupId:null,creativeId:null,network:null,device:null};
    if (out.source === 'google' && out.medium === 'cpc') {
      for (const k of ['campaignId','adGroupId','creativeId']) if (typeof a[k] === 'string' && /^[0-9]{1,30}$/.test(a[k])) out[k] = a[k];
      if (['g','s','d'].includes(a.network)) out.network = a.network;
      if (['c','m','t'].includes(a.device)) out.device = a.device;
    }
    return out;
  }
  function pageCode(pathname) {
    let h = 2166136261;
    for (const c of normalizePath(pathname)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return 'p-' + (h >>> 0).toString(16).padStart(8,'0');
  }
  function shouldMeasure(config, location, navigator) {
    return config.measurementEnabled === true &&
      ['https://mft.care','https://www.mft.care'].includes(location.origin) &&
      !/^\/marriage-reset-assessment(?:\/|$)/.test(location.pathname) &&
      navigator.globalPrivacyControl !== true && navigator.doNotTrack !== '1';
  }
  return {normalizePath, clinicianForPath, destination, attributes, isAppointment, acquisition, cleanAcquisition, pageCode, shouldMeasure};
});
