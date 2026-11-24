'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const analytics = require('../src/analytics-build');
const { measurementReport, LEGACY_BOOKING_MEASUREMENT_ENABLED, FINAL_VERIFIED_SCOPE } = require('../src/measurement-report');
const production = {CONTEXT:'production', SITE_INDEXING_ENABLED:'true', GA4_BASIC_MEASUREMENT_ENABLED:'false', OPS_HANDOFF_COLLECTION_ENABLED:'true'};

function validationFixture(env = production) {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'mft-report-contract-'));
  fs.mkdirSync(path.join(dist, 'reports'));
  fs.mkdirSync(path.join(dist, 'draft'));
  const active = analytics.controllerEnabled(env);
  const report = {version:2, enabled:false, measurement:measurementReport(env), allowedRoutes:[], allowedEvents:[],
    controllerEnabled:active, controllerAllowedRoutes:['/'], injected:active?['/']:[], excluded:[], googlePages:[]};
  const html = analytics.inject('<html><body>Approved public page</body></html>', '/', new Set(['/']), env).html;
  const headers = "/*\n  Content-Security-Policy: default-src 'self'; script-src 'self'; connect-src 'self'"+(active?' https://ops.mft.care':'')+"; frame-src https://clientsecure.me;\n";
  const write = (relative, value) => fs.writeFileSync(path.join(dist, relative), typeof value === 'string' ? value : JSON.stringify(value));
  write('index.html', html);
  write('draft/index.html', html);
  write('_headers', headers);
  write('sitemap.xml', '<urlset><url><loc>https://www.mft.care/</loc></url></urlset>');
  write('reports/analytics-integration.json', report);
  return {dist, report, html, headers, write, remove:() => fs.rmSync(dist, {recursive:true, force:true})};
}

test('reports separate first-party collection from the blocked Google runtime and retired collector', () => {
  const report = measurementReport({...production, GA4_BASIC_MEASUREMENT_ENABLED:'true'});
  assert.equal(LEGACY_BOOKING_MEASUREMENT_ENABLED, false);
  assert.equal(report.legacyBookingCollector.enabled, false);
  assert.equal(report.legacyBookingCollector.controlsConsentControlledGa4, false);
  assert.equal(report.firstPartyController.buildEnabled, true);
  assert.equal(report.firstPartyController.runtimeEntryPoint, 'MFTSchedulingMeasurement.track');
  assert.equal(report.firstPartyController.browserConsentVersion, 'mft.analytics.consent.v5');
  assert.equal(report.consentControlledGa4.buildEnabled, false);
  assert.equal(report.consentControlledGa4.requestedByEnvironment, true);
  assert.equal(report.consentControlledGa4.configuredMeasurementId, 'G-BTK39BBNRE');
  assert.equal(report.consentControlledGa4.runtimeEntryPoint, null);
  assert.equal(report.consentControlledGa4.mode, 'disabled');
  assert.equal(report.consentControlledGa4.policy.status, 'blocked-sensitive-context');
  assert.deepEqual(report.consentControlledGa4.policy.approvedRoutes, []);
  assert.deepEqual(report.consentControlledGa4.policy.approvedEvents, []);
  assert.deepEqual(report.consentControlledGa4.advertisingMeasurement, {
    available:false, status:'unavailable', preferenceVersion:'mft.advertising.consent.v1', storedPreference:'denied'
  });
  for (const env of [{...production, CONTEXT:'deploy-preview'}, {...production, CONTEXT:'branch-deploy'},
    {...production, NETLIFY_PREVIEW_SERVER:'true'}, {...production, SITE_INDEXING_ENABLED:'false'}]) {
    assert.equal(measurementReport(env).firstPartyController.buildEnabled, false);
    assert.equal(measurementReport(env).consentControlledGa4.buildEnabled, false);
  }
});

test('the reported scheduling metric has one source event and excludes diagnostics and dialog-only actions', () => {
  const metric = measurementReport(production).schedulingMetric;
  assert.equal(metric.displayName, 'Website scheduling-link click');
  assert.equal(metric.sourceEvent, 'simplepractice_exit');
  assert.deepEqual(metric.diagnosticEvents, ['appointment_request_click', 'clinician_schedule_click', 'consultation_click']);
  assert.equal(metric.diagnosticEventsCountTowardMetric, false);
  assert.equal(metric.establishesAppointment, false);
  assert.deepEqual(metric.excludedActions, ['dialog open', 'dialog close or cancel', 'dialog acknowledgment', 'existing-client sign-in']);
  assert.equal(metric.dialogHandoff, 'enabled Continue navigation only');
  assert.doesNotMatch(JSON.stringify(metric), /"scheduling_click"/);
});

test('Ops preserves its receiver contract while using the narrower browser consent and an independent gate', () => {
  const off = measurementReport({...production, OPS_HANDOFF_COLLECTION_ENABLED:'false'}).consentControlledOps;
  assert.equal(off.buildEnabled, false);
  assert.equal(off.endpoint, null);
  for (const ga4Flag of ['true', 'false']) {
    const report = measurementReport({...production, GA4_BASIC_MEASUREMENT_ENABLED:ga4Flag});
    const ops = report.consentControlledOps;
    assert.equal(ops.buildEnabled, true);
    assert.equal(ops.event, 'simplepractice_exit');
    assert.equal(ops.consentVersion, 'mft.analytics.consent.v4');
    assert.equal(ops.browserConsentVersion, 'mft.analytics.consent.v5');
    assert.equal(ops.visitorIdentifier, false);
    assert.equal(ops.sourceLifetimeMinutes, 30);
    assert.equal(ops.eventRetentionDays, 30);
    assert.match(ops.appointmentMatching, /unmatched/);
    assert.match(report.externalVerification.opsHandoffReceipt, /not verified/);
    assert.match(report.externalVerification.simplePracticeRequestVerification, /not established by website activity/);
  }
});

test('build metadata never turns configuration into account receipt evidence or exposes unrelated environment data', () => {
  const report = measurementReport({...production, PRIVATE_ACCOUNT:'synthetic-private-account', PRIVATE_APPROVER:'synthetic-private-reviewer'});
  assert.equal(report.externalVerification.googleCollectorAcceptance, 'not verified by this report');
  assert.equal(report.externalVerification.ga4PropertyReceipt, 'not verified by this report');
  assert.equal(report.externalVerification.googleAdsAttribution, 'not verified by this report');
  assert.equal(report.externalVerification.confirmedAppointments, 'not measured');
  assert.doesNotMatch(JSON.stringify(report), /synthetic-private/);
});

test('artifact validation counts only first-party pages, strips inherited draft controllers, and reports zero Google pages', () => {
  const f = validationFixture({...production, GA4_BASIC_MEASUREMENT_ENABLED:'true'});
  try {
    require('../scripts/validate-analytics').apply(f.dist);
    const actual = JSON.parse(fs.readFileSync(path.join(f.dist, 'reports/analytics-integration.json'), 'utf8'));
    assert.equal(actual.enabled, false);
    assert.equal(actual.finalVerified, true);
    assert.equal(actual.finalVerifiedScope, FINAL_VERIFIED_SCOPE);
    assert.deepEqual(actual.finalPages, ['/']);
    assert.deepEqual(actual.controllerPages, ['/']);
    assert.deepEqual(actual.opsHandoffPages, ['/']);
    assert.deepEqual(actual.googlePages, []);
    assert.equal(actual.removedInheritedTags, 1);
    assert.equal(actual.measurement.legacyBookingCollector.enabled, false);
    assert.equal(actual.measurement.consentControlledGa4.buildEnabled, false);
    assert.equal(actual.measurement.externalVerification.ga4PropertyReceipt, 'not verified by this report');
    assert.equal(actual.measurement.externalVerification.googleAdsAttribution, 'not verified by this report');
  } finally { f.remove(); }
});

test('validation rejects a Google-enabled report, an active Google tag, and Google CSP hosts', () => {
  for (const mutate of [
    f => { f.report.enabled = true; f.write('reports/analytics-integration.json', f.report); },
    f => { f.report.allowedRoutes = ['/']; f.write('reports/analytics-integration.json', f.report); },
    f => f.write('index.html', f.html.replace('</body>', '<script src="https://www.googletagmanager.com/gtag/js?id=G-BTK39BBNRE"></script></body>')),
    f => f.write('index.html', f.html.replace('</body>', '<script src="/assets/mft-ga4-bootstrap.js"></script></body>')),
    f => f.write('_headers', f.headers.replace("script-src 'self'", "script-src 'self' https://www.googletagmanager.com")),
    f => f.write('_headers', f.headers.replace(' https://ops.mft.care', ''))
  ]) {
    const f = validationFixture();
    try { mutate(f); assert.throws(() => require('../scripts/validate-analytics').apply(f.dist), /Google|handoff CSP/); }
    finally { f.remove(); }
  }
});

test('an Ops-disabled build validates as zero controller, Ops and Google pages', () => {
  const f = validationFixture({...production, OPS_HANDOFF_COLLECTION_ENABLED:'false', GA4_BASIC_MEASUREMENT_ENABLED:'true'});
  try {
    require('../scripts/validate-analytics').apply(f.dist);
    const actual = JSON.parse(fs.readFileSync(path.join(f.dist, 'reports/analytics-integration.json'), 'utf8'));
    assert.deepEqual(actual.controllerPages, []);
    assert.deepEqual(actual.opsHandoffPages, []);
    assert.deepEqual(actual.googlePages, []);
  } finally { f.remove(); }
});
