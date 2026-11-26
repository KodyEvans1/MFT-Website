'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const analytics = require('../src/analytics-build');
const csp = require('../src/google-measurement-csp');
const { measurementReport, LEGACY_BOOKING_MEASUREMENT_ENABLED, FINAL_VERIFIED_SCOPE } = require('../src/measurement-report');
const production = {CONTEXT:'production', SITE_INDEXING_ENABLED:'true', GA4_BASIC_MEASUREMENT_ENABLED:'false', OPS_HANDOFF_COLLECTION_ENABLED:'true'};
const hashFile = relative => createHash('sha256').update(fs.readFileSync(path.join(__dirname, '..', relative))).digest('hex');

function syntheticReviewedPolicy() {
  return {...analytics.googlePolicy(), status:'approved-reviewed-scope',
    approvedRoutes:['/', '/about/'], approvedEvents:['simplepractice_exit'],
    reason:'Synthetic report fixture, not a production permission decision.',
    review:{decision:'permitted', decisionReference:'tests/synthetic-review-only-do-not-publish',
      flowSha256:hashFile('content/google-measurement-flow.json'),
      runtimeSha256:hashFile('src/assets/mft-google-measurement.js'),
      networkEvidenceSha256:createHash('sha256').update('Synthetic report evidence only').digest('hex')}};
}

function validationFixture(env = production) {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'mft-report-contract-'));
  fs.mkdirSync(path.join(dist, 'reports'));
  fs.mkdirSync(path.join(dist, 'draft'));
  const active = analytics.controllerEnabled(env);
  const report = {version:2, enabled:false, measurement:measurementReport(env), allowedRoutes:[], allowedEvents:[],
    controllerEnabled:active, controllerAllowedRoutes:['/'], injected:active?['/']:[], excluded:[], googlePages:[]};
  const html = analytics.inject('<html><body>Approved public page</body></html>', '/', new Set(['/']), env).html;
  const headers = "/*\n  Content-Security-Policy: default-src 'self'; script-src 'self'; connect-src 'self'"+(active?' https://ops.mft.care':'')+"; img-src 'self' data:; frame-src https://clientsecure.me;\n";
  const write = (relative, value) => {
    const file = path.join(dist, relative);
    fs.mkdirSync(path.dirname(file), {recursive:true});
    fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  };
  write('index.html', html);
  write('draft/index.html', html);
  write('_headers', headers);
  write('sitemap.xml', '<urlset><url><loc>https://www.mft.care/</loc></url></urlset>');
  write('reports/analytics-integration.json', report);
  return {dist, report, html, headers, write, remove:() => fs.rmSync(dist, {recursive:true, force:true})};
}

function approvedValidationFixture() {
  const f = validationFixture();
  const policy = syntheticReviewedPolicy();
  const env = {...production, GA4_BASIC_MEASUREMENT_ENABLED:'true'};
  const routes = ['/', '/about/', '/services/'];
  const document = '<html><head><title>Synthetic public page</title></head><body>Public information</body></html>';
  const pages = {};
  for (const route of routes) {
    const relative = route === '/' ? 'index.html' : route.slice(1)+'index.html';
    const title = analytics.REVIEWED_DOCUMENT_TITLES[route] || 'Synthetic public page';
    const page = document.replace('Synthetic public page', title.replace(/&/g, '&amp;'));
    pages[relative] = analytics.inject(page, route, new Set(routes), env, policy).html;
    f.write(relative, pages[relative]);
  }
  // An inherited draft must lose both integrations and get the strict CSP.
  pages['draft/index.html'] = pages['index.html'];
  pages['check-my-coverage/index.html'] = document.replace('Public information', '<form><input></form>');
  pages['assets/mft-ga4-frame.html'] = '<html><head><meta name="robots" content="noindex,nofollow"></head><body></body></html>';
  for (const relative of ['draft/index.html', 'check-my-coverage/index.html', 'assets/mft-ga4-frame.html'])
    f.write(relative, pages[relative]);
  const headers = csp.permitGoogle(f.headers).headers+'  Referrer-Policy: no-referrer\n';
  const report = {...f.report, enabled:true, measurement:measurementReport(env, policy),
    allowedRoutes:[...policy.approvedRoutes], allowedEvents:[...policy.approvedEvents],
    controllerAllowedRoutes:routes, injected:routes};
  f.write('_headers', headers);
  f.write('sitemap.xml', '<urlset>'+routes.map(route => '<url><loc>https://www.mft.care'+route+'</loc></url>').join('')+'</urlset>');
  f.write('reports/analytics-integration.json', report);
  return {...f, policy, pages, report, headers, restrictedHeaders:f.headers};
}

test('reports separate first-party collection from the blocked Google runtime and retired collector', () => {
  const report = measurementReport({...production, GA4_BASIC_MEASUREMENT_ENABLED:'true'});
  assert.equal(report.version, 4);
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
  assert.equal(report.consentControlledGa4.runtimeAsset, null);
  assert.equal(report.consentControlledGa4.mode, 'disabled');
  assert.equal(report.consentControlledGa4.policy.version, 2);
  assert.equal(report.consentControlledGa4.policy.status, 'blocked-sensitive-context');
  assert.equal(report.consentControlledGa4.policy.review, null);
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

test('blocked reports identify the exact candidate bytes without presenting them as active or reviewed', () => {
  const ga4 = measurementReport(production).consentControlledGa4;
  assert.equal(ga4.candidateRuntime.asset, '/assets/mft-google-measurement.js');
  assert.equal(ga4.candidateRuntime.sha256, hashFile('src/assets/mft-google-measurement.js'));
  assert.deepEqual(ga4.dataFlow, {file:'content/google-measurement-flow.json', sha256:hashFile('content/google-measurement-flow.json')});
  assert.equal(ga4.buildEnabled, false);
  assert.equal(ga4.policy.review, null);
  assert.equal(ga4.advertisingMeasurement.available, false);
  assert.match(ga4.candidateRuntime.activation, /review.*hashes.*network evidence/i);
});

test('a synthetic reviewed report exposes only the selected runtime and a fresh advertising choice, never receipt evidence', () => {
  const policy = syntheticReviewedPolicy();
  const report = measurementReport({...production, GA4_BASIC_MEASUREMENT_ENABLED:'true'}, policy);
  const ga4 = report.consentControlledGa4;
  assert.equal(report.version, 4);
  assert.equal(ga4.buildEnabled, true);
  assert.equal(ga4.mode, 'approved-main-page');
  assert.equal(ga4.runtimeEntryPoint, 'MFTGoogleMeasurement.handoff');
  assert.equal(ga4.runtimeAsset, '/assets/mft-google-measurement.js');
  assert.equal(ga4.runtimeConsentRequired, true);
  assert.deepEqual(ga4.policy, policy);
  assert.deepEqual(ga4.advertisingMeasurement, {
    available:true, status:'fresh-choice-required', preferenceVersion:'mft.advertising.consent.v2', storedPreference:'not-pregranted'
  });
  assert.equal(ga4.dataFlow.sha256, policy.review.flowSha256);
  assert.equal(ga4.candidateRuntime.sha256, policy.review.runtimeSha256);
  assert.equal(report.evidenceScope, 'website build configuration only');
  for (const field of ['googleCollectorAcceptance', 'ga4PropertyReceipt', 'googleAdsAttribution'])
    assert.equal(report.externalVerification[field], 'not verified by this report', field);
  assert.equal(report.externalVerification.confirmedAppointments, 'not measured');
  assert.equal(report.consentControlledOps.visitorIdentifier, false);
  assert.equal(report.consentControlledOps.consentVersion, 'mft.analytics.consent.v4');
});

test('reporting does not activate reviewed evidence in previews or when either production flag is off', () => {
  const policy = syntheticReviewedPolicy();
  const requested = {...production, GA4_BASIC_MEASUREMENT_ENABLED:'true'};
  for (const env of [production, {...requested, OPS_HANDOFF_COLLECTION_ENABLED:'false'},
    {...requested, CONTEXT:'deploy-preview'}, {...requested, CONTEXT:'branch-deploy'},
    {...requested, SITE_INDEXING_ENABLED:'false'}, {...requested, NETLIFY_PREVIEW_SERVER:'true'}]) {
    const ga4 = measurementReport(env, policy).consentControlledGa4;
    assert.equal(ga4.buildEnabled, false);
    assert.equal(ga4.mode, 'disabled');
    assert.equal(ga4.runtimeEntryPoint, null);
    assert.equal(ga4.runtimeAsset, null);
    assert.equal(ga4.advertisingMeasurement.available, false);
    assert.equal(ga4.advertisingMeasurement.storedPreference, 'denied');
  }
  const stale = {...policy, review:{...policy.review, flowSha256:'0'.repeat(64)}};
  assert.throws(() => measurementReport(requested, stale), /matching flow, runtime/);
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
    assert.equal(actual.version, 2);
    assert.equal(actual.measurement.version, 4);
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
    f => f.write('index.html', f.html.replace('</body>', '<script src="/assets/mft-google-measurement.js"></script></body>')),
    f => f.write('index.html', f.html.replace('</body>', '<script src="/assets/mft-ga4-bootstrap.js"></script></body>')),
    f => f.write('_headers', f.headers.replace("script-src 'self'", "script-src 'self' https://www.googletagmanager.com")),
    f => f.write('_headers', f.headers.replace(' https://ops.mft.care', ''))
  ]) {
    const f = validationFixture();
    try { mutate(f); assert.throws(() => require('../scripts/validate-analytics').apply(f.dist), /Google|handoff CSP/); }
    finally { f.remove(); }
  }
});

test('a synthetic approved artifact keeps Google inventory separate and restricts every excluded HTML document before other head content', () => {
  const f = approvedValidationFixture();
  try {
    require('../scripts/validate-analytics').apply(f.dist, f.policy);
    const actual = JSON.parse(fs.readFileSync(path.join(f.dist, 'reports/analytics-integration.json'), 'utf8'));
    assert.equal(actual.version, 2);
    assert.equal(actual.measurement.version, 4);
    assert.equal(actual.enabled, true);
    assert.equal(actual.finalVerified, true);
    assert.equal(actual.finalVerifiedScope, FINAL_VERIFIED_SCOPE);
    assert.deepEqual(actual.googlePages, ['/', '/about/']);
    assert.deepEqual(actual.controllerPages, ['/', '/about/', '/services/']);
    assert.deepEqual(actual.opsHandoffPages, actual.controllerPages);
    assert.equal(actual.removedInheritedTags, 1);
    assert.equal(actual.measurement.externalVerification.googleAdsAttribution, 'not verified by this report');
    for (const relative of ['index.html', 'about/index.html']) {
      const html = fs.readFileSync(path.join(f.dist, relative), 'utf8');
      assert.doesNotMatch(html, /data-mft-google-denied=/);
      assert.equal((html.match(/mft-google-measurement\.js/g) || []).length, 1);
    }
    for (const relative of ['services/index.html', 'draft/index.html', 'check-my-coverage/index.html', 'assets/mft-ga4-frame.html']) {
      const html = fs.readFileSync(path.join(f.dist, relative), 'utf8');
      assert.match(html, /<head><meta data-mft-google-denied="true" http-equiv="Content-Security-Policy"/);
      assert.equal((html.match(/data-mft-google-denied=/g) || []).length, 1);
      assert.doesNotMatch(html, /googletagmanager|google-analytics|mft-google-measurement\.js/);
      if (relative !== 'services/index.html') assert.doesNotMatch(html, /mft-analytics\.js/);
    }
    // Revalidation preserves the one strict policy instead of duplicating it.
    require('../scripts/validate-analytics').apply(f.dist, f.policy);
    assert.equal((fs.readFileSync(path.join(f.dist, 'services/index.html'), 'utf8').match(/data-mft-google-denied=/g) || []).length, 1);
  } finally { f.remove(); }
});

test('approved artifact validation rejects extra Google destinations, missing no-referrer, and weakened or late excluded-page CSP', () => {
  const cases = [
    ['missing no-referrer', f => f.write('_headers', f.headers.replace('  Referrer-Policy: no-referrer\n', ''))],
    ['additional Ads endpoint', f => f.write('_headers', f.headers.replace("connect-src 'self'", "connect-src 'self' https://www.googleadservices.com"))],
    ['wildcard collector', f => f.write('_headers', f.headers.replace('https://region1.google-analytics.com', 'https://*.google-analytics.com'))],
    ['missing collector', f => f.write('_headers', f.headers.replace(' https://region1.google-analytics.com', ''))],
    ['weakened page CSP', f => f.write('services/index.html', csp.restrictHtml(f.pages['services/index.html'], csp.headerPolicy(f.headers)))],
    ['late page CSP', f => {
      const restricted = csp.restrictHtml(f.pages['services/index.html'], csp.headerPolicy(f.restrictedHeaders));
      f.write('services/index.html', restricted.replace('<head>', '<head><script src="/before-policy.js"></script>'));
    }]
  ];
  for (const [label, mutate] of cases) {
    const f = approvedValidationFixture();
    try {
      mutate(f);
      assert.throws(() => require('../scripts/validate-analytics').apply(f.dist, f.policy), /Google CSP|strict Google CSP/, label);
    } finally { f.remove(); }
  }
});

test('reviewed CSP permits all observed native measurement destinations while excluded documents retain the original policy', () => {
  const f = approvedValidationFixture();
  try {
    const expectedDestinations = [
      'https://analytics.google.com', 'https://www.google-analytics.com',
      'https://region1.google-analytics.com', 'https://www.google.com',
      'https://stats.g.doubleclick.net', 'https://www.googletagmanager.com'
    ];
    const directives = Object.fromEntries(csp.headerPolicy(f.headers).split(';').map(value => value.trim().split(/\s+/)).filter(value => value[0]).map(([name,...values]) => [name,values]));
    assert.deepEqual(directives['script-src'], ["'self'", 'https://www.googletagmanager.com']);
    assert.deepEqual(directives['connect-src'], ["'self'", 'https://ops.mft.care', ...expectedDestinations]);
    assert.deepEqual(directives['img-src'], ["'self'", 'data:', ...expectedDestinations]);
    assert.deepEqual(directives['frame-src'], ['https://clientsecure.me']);
    assert.equal(csp.removeGooglePermission(f.headers), f.restrictedHeaders+'  Referrer-Policy: no-referrer\n');
    require('../scripts/validate-analytics').apply(f.dist, f.policy);
    const strictMeta = csp.restrictedMeta(csp.headerPolicy(f.restrictedHeaders));
    for (const relative of ['services/index.html', 'draft/index.html', 'check-my-coverage/index.html', 'assets/mft-ga4-frame.html']) {
      const html = fs.readFileSync(path.join(f.dist, relative), 'utf8');
      assert.ok(html.includes('<head>'+strictMeta), relative);
      for (const destination of expectedDestinations) assert.equal(strictMeta.includes(destination), false);
    }
  } finally { f.remove(); }
});

test('approved artifact validation rejects missing, duplicate, reordered or unreviewed runtime tags', () => {
  const googleTag = html => html.match(/<script\b[^>]*src="[^"]*mft-google-measurement\.js[^>]*><\/script>/)[0];
  const cases = [
    ['missing runtime', f => f.write('about/index.html', f.pages['about/index.html'].replace(googleTag(f.pages['about/index.html']), ''))],
    ['duplicate runtime', f => f.write('index.html', f.pages['index.html'].replace('</body>', googleTag(f.pages['index.html'])+'</body>'))],
    ['runtime after controller', f => {
      const tag = googleTag(f.pages['index.html']);
      f.write('index.html', f.pages['index.html'].replace(tag, '').replace('</body>', tag+'</body>'));
    }],
    ['wrong review digest', f => f.write('index.html', f.pages['index.html'].replace(analytics.googleReviewDigest(f.policy), '0'.repeat(64)))],
    ['runtime on service page', f => f.write('services/index.html', f.pages['services/index.html'].replace('</body>', googleTag(f.pages['index.html'])+'</body>'))]
  ];
  for (const [label, mutate] of cases) {
    const f = approvedValidationFixture();
    try {
      mutate(f);
      assert.throws(() => require('../scripts/validate-analytics').apply(f.dist, f.policy), /Google runtime/, label);
    } finally { f.remove(); }
  }
});

test('final reviewed artifact validation rejects document title changes after injection', () => {
  for (const relative of ['index.html', 'about/index.html']) {
    const f = approvedValidationFixture();
    try {
      f.write(relative, f.pages[relative].replace(/<title>[\s\S]*?<\/title>/, '<title>Unreviewed clinical context</title>'));
      assert.throws(() => require('../scripts/validate-analytics').apply(f.dist, f.policy), /document title differs/);
    } finally { f.remove(); }
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
