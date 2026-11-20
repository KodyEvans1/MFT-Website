'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const analytics = require('../src/analytics-build');
const { measurementReport, LEGACY_BOOKING_MEASUREMENT_ENABLED, FINAL_VERIFIED_SCOPE } = require('../src/measurement-report');
const production = { CONTEXT:'production', SITE_INDEXING_ENABLED:'true', GA4_BASIC_MEASUREMENT_ENABLED:'true' };

test('reports distinguish an enabled consent-required GA4 build from the disabled legacy collector', () => {
  const report = measurementReport(production);
  assert.equal(LEGACY_BOOKING_MEASUREMENT_ENABLED, false);
  assert.equal(report.legacyBookingCollector.enabled, false);
  assert.equal(report.legacyBookingCollector.controlsConsentControlledGa4, false);
  assert.equal(report.consentControlledGa4.buildEnabled, true);
  assert.equal(report.consentControlledGa4.runtimeConsentRequired, true);
  assert.equal(report.consentControlledGa4.runtimeEntryPoint, 'MFTSchedulingMeasurement.track');
  for (const env of [
    {...production, CONTEXT:'deploy-preview'},
    {...production, CONTEXT:'branch-deploy'},
    {...production, NETLIFY_PREVIEW_SERVER:'true'},
    {...production, SITE_INDEXING_ENABLED:'false'},
    {...production, GA4_BASIC_MEASUREMENT_ENABLED:'false'}
  ]) assert.equal(measurementReport(env).consentControlledGa4.buildEnabled, false);
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

test('build metadata does not turn environment data or configuration into account receipt evidence', () => {
  const report = measurementReport({...production, PRIVATE_ACCOUNT:'synthetic-private-account', PRIVATE_APPROVER:'synthetic-private-reviewer'});
  assert.equal(report.externalVerification.googleCollectorAcceptance, 'not verified by this report');
  assert.equal(report.externalVerification.ga4PropertyReceipt, 'not verified by this report');
  assert.equal(report.externalVerification.googleAdsAttribution, 'not verified by this report');
  assert.equal(report.externalVerification.confirmedAppointments, 'not measured');
  assert.doesNotMatch(JSON.stringify(report), /synthetic-private/);
});

test('successful artifact validation preserves compatibility and labels its evidence without asserting external receipt', () => {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'mft-report-contract-'));
  try {
    fs.mkdirSync(path.join(dist, 'reports'));
    fs.mkdirSync(path.join(dist, 'draft'));
    const report = {version:1, enabled:true, measurement:measurementReport(production), injected:['/'], excluded:[]};
    const html = analytics.inject('<html><body>Approved public page</body></html>', '/', new Set(['/']), production).html;
    fs.writeFileSync(path.join(dist, 'index.html'), html);
    fs.writeFileSync(path.join(dist, 'draft/index.html'), html);
    fs.writeFileSync(path.join(dist, 'sitemap.xml'), '<urlset><url><loc>https://www.mft.care/</loc></url></urlset>');
    fs.writeFileSync(path.join(dist, 'reports/analytics-integration.json'), JSON.stringify(report));
    require('../scripts/validate-analytics').apply(dist);
    const actual = JSON.parse(fs.readFileSync(path.join(dist, 'reports/analytics-integration.json'), 'utf8'));
    assert.equal(actual.enabled, true);
    assert.equal(actual.finalVerified, true);
    assert.equal(actual.finalVerifiedScope, FINAL_VERIFIED_SCOPE);
    assert.deepEqual(actual.finalPages, ['/']);
    assert.equal(actual.removedInheritedTags, 1);
    assert.equal(actual.measurement.legacyBookingCollector.enabled, false);
    assert.equal(actual.measurement.consentControlledGa4.buildEnabled, true);
    assert.equal(actual.measurement.externalVerification.ga4PropertyReceipt, 'not verified by this report');
    assert.equal(actual.measurement.externalVerification.googleAdsAttribution, 'not verified by this report');
  } finally {
    fs.rmSync(dist, {recursive:true, force:true});
  }
});
