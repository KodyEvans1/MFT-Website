'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const a = require('../src/analytics-build');
const production = {CONTEXT:'production', SITE_INDEXING_ENABLED:'true', GA4_BASIC_MEASUREMENT_ENABLED:'false', OPS_HANDOFF_COLLECTION_ENABLED:'true'};
const requestedProduction = {...production, GA4_BASIC_MEASUREMENT_ENABLED:'true'};
const publicHtml = '<html><head><title>Marriage.Family.Therapy | Woodinville &amp; Online in Washington</title></head><body><a href="https://marriagefamilytherapy.clientsecure.me/">Book</a></body></html>';
const htmlForRoute = route => route === '/about/' ? publicHtml.replace(/<title>[\s\S]*?<\/title>/, '<title>About Marriage.Family.Therapy | Woodinville, WA</title>') : publicHtml;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceBytes = relative => fs.readFileSync(path.join(__dirname, '..', relative));

// Test-only evidence; this fixture is never written to the production policy.
function syntheticReviewedPolicy() {
  return {
    ...a.googlePolicy(), status:'approved-reviewed-scope',
    approvedRoutes:['/', '/about/'], approvedEvents:['simplepractice_exit'],
    reason:'Synthetic build fixture only; not an external permission decision.',
    review:{
      decision:'permitted', decisionReference:'tests/synthetic-review-only-do-not-publish',
      flowSha256:sha256(sourceBytes('content/google-measurement-flow.json')),
      runtimeSha256:sha256(sourceBytes('src/assets/mft-google-measurement.js')),
      networkEvidenceSha256:sha256('Synthetic intercepted evidence, never a live receipt')
    }
  };
}

test('Google stays disabled even when a production environment requests it', () => {
  for (const env of [production, {...production, GA4_BASIC_MEASUREMENT_ENABLED:'true'},
    {...production, CONTEXT:'deploy-preview', GA4_BASIC_MEASUREMENT_ENABLED:'true'},
    {...production, SITE_INDEXING_ENABLED:'false', GA4_BASIC_MEASUREMENT_ENABLED:'true'}])
    assert.equal(a.enabled(env), false);
  assert.equal(a.googleRequested({...production, GA4_BASIC_MEASUREMENT_ENABLED:'true'}), true);
  assert.equal(a.googleRequested(production), false);
});

test('Google route and event approval is explicit, empty, and independent of public indexing', () => {
  const policy = a.googlePolicy();
  assert.equal(policy.version, 2);
  assert.equal(policy.status, 'blocked-sensitive-context');
  assert.deepEqual(policy.approvedRoutes, []);
  assert.deepEqual(policy.approvedEvents, []);
  assert.equal(policy.review, null);
  for (const route of ['/', '/services/', '/emily-johnsrud-bio/', '/gary-ashley-bio/'])
    for (const event of ['page_view', 'simplepractice_exit']) assert.equal(a.isGoogleEligible(route, event), false);
  for (const changed of [{...policy, approvedRoutes:['/']}, {...policy, approvedEvents:['simplepractice_exit']},
    {...policy, status:'approved'}, {...policy, version:1}, {...policy, review:syntheticReviewedPolicy().review}])
    assert.throws(() => a.validateGooglePolicy(changed), /Unsupported Google measurement policy/);
  policy.approvedRoutes.push('/');
  assert.equal(a.isGoogleEligible('/', 'simplepractice_exit'), false);
});

test('a synthetic review binds activation to the complete current flow and runtime bytes', () => {
  const policy = syntheticReviewedPolicy();
  assert.equal(a.flowHash(), policy.review.flowSha256);
  assert.equal(a.runtimeHash(), policy.review.runtimeSha256);
  assert.equal(a.assetVersion('mft-google-measurement.js'), policy.review.runtimeSha256.slice(0,16));
  assert.equal(a.enabled(requestedProduction, policy), true);
  assert.equal(a.googleReviewDigest(policy), sha256(JSON.stringify(policy.review)));
  assert.equal(a.googleReviewDigest(a.googlePolicy()), null);

  // Semantically equivalent JSON still changes the reviewed full-file bytes.
  const reformattedFlow = JSON.stringify(JSON.parse(sourceBytes('content/google-measurement-flow.json')));
  assert.notEqual(sha256(reformattedFlow), policy.review.flowSha256);
  for (const [field, changedBytes] of [
    ['flowSha256', reformattedFlow],
    ['runtimeSha256', Buffer.concat([sourceBytes('src/assets/mft-google-measurement.js'), Buffer.from('\n// changed after review\n')])]
  ]) {
    const stale = {...policy, review:{...policy.review, [field]:sha256(changedBytes)}};
    assert.throws(() => a.enabled(requestedProduction, stale), /matching flow, runtime/);
    assert.throws(() => a.inject(publicHtml, '/', new Set(['/']), requestedProduction, stale), /matching flow, runtime/);
  }
});

test('incomplete evidence and expanded routes or events cannot activate a reviewed build', () => {
  const cases = [
    ['missing decision', policy => { delete policy.review.decision; }],
    ['unresolved decision', policy => { policy.review.decision = 'pending'; }],
    ['missing reference', policy => { policy.review.decisionReference = ''; }],
    ['malformed network evidence', policy => { policy.review.networkEvidenceSha256 = 'not-a-sha256'; }],
    ['extra review field', policy => { policy.review.publicationApproved = true; }],
    ['missing review', policy => { policy.review = null; }],
    ['no approved routes', policy => { policy.approvedRoutes = []; }],
    ['duplicate route', policy => { policy.approvedRoutes.push('/'); }],
    ['clinician route', policy => { policy.approvedRoutes.push('/gary-ashley-bio/'); }],
    ['wildcard route', policy => { policy.approvedRoutes = ['/*']; }],
    ['noncanonical policy route', policy => { policy.approvedRoutes = ['/about']; }],
    ['diagnostic event', policy => { policy.approvedEvents = ['appointment_request_click']; }],
    ['additional automatic event', policy => { policy.approvedEvents.push('page_view'); }]
  ];
  for (const [label, mutate] of cases) {
    const policy = syntheticReviewedPolicy();
    mutate(policy);
    assert.throws(() => a.validateGooglePolicy(policy), /Unsupported Google measurement policy/, label);
    assert.throws(() => a.isGoogleEligible('/', 'simplepractice_exit', policy), /Unsupported Google measurement policy/, label);
    assert.throws(() => a.enabled(requestedProduction, policy), /Unsupported Google measurement policy/, label);
    assert.throws(() => a.inject(publicHtml, '/', new Set(['/']), requestedProduction, policy), /Unsupported Google measurement policy/, label);
  }
});

test('reviewed evidence still requires production indexing and both independent build flags', () => {
  const policy = syntheticReviewedPolicy();
  for (const env of [
    production,
    {...requestedProduction, OPS_HANDOFF_COLLECTION_ENABLED:'false'},
    {...requestedProduction, CONTEXT:'deploy-preview'},
    {...requestedProduction, CONTEXT:'branch-deploy'},
    {...requestedProduction, SITE_INDEXING_ENABLED:'false'},
    {...requestedProduction, NETLIFY_PREVIEW_SERVER:'true'}
  ]) {
    assert.equal(a.enabled(env, policy), false, JSON.stringify(env));
    const result = a.inject(publicHtml, '/', new Set(['/']), env, policy);
    assert.notEqual(result.googleInjected, true);
    assert.doesNotMatch(result.html, /mft-google-measurement\.js|data-mft-google-measurement-id/);
  }
});

test('reviewed scope installs one deferred Google runtime before the first-party controller on only eligible public routes', () => {
  const policy = syntheticReviewedPolicy();
  const allowed = new Set(['/', '/about/', '/services/', '/gary-ashley-bio/', '/tri-cities/']);
  for (const route of ['/', '/about/']) {
    assert.equal(a.isGoogleEligible(route, 'simplepractice_exit', policy), true);
    const input = htmlForRoute(route);
    const result = a.inject(input, route, allowed, requestedProduction, policy);
    assert.equal(result.injected, true);
    assert.equal(result.googleInjected, true);
    assert.equal((result.html.match(/mft-google-measurement\.js/g) || []).length, 1);
    assert.equal((result.html.match(/mft-analytics\.js/g) || []).length, 1);
    assert.ok(result.html.indexOf('mft-google-measurement.js') < result.html.indexOf('mft-analytics.js'));
    assert.match(result.html, /mft-google-measurement\.js\?v=[a-f0-9]{16}" defer/);
    assert.ok(result.html.includes('data-mft-google-route="'+route+'"'));
    assert.ok(result.html.includes('data-mft-google-approved-review="'+a.googleReviewDigest(policy)+'"'));
    assert.match(result.html, /data-mft-google-event="simplepractice_exit"/);
    assert.match(result.html, /data-mft-google-mode="approved-main-page"/);
    assert.doesNotMatch(result.html, /googletagmanager\.com|google-analytics\.com|mft-ga4-/);
    assert.equal(a.strip(result.html), input);
    assert.throws(() => a.inject(result.html, route, allowed, requestedProduction, policy), /refusing duplicate/);
  }
  for (const route of ['/services/', '/gary-ashley-bio/', '/tri-cities/']) {
    assert.equal(a.isGoogleEligible(route, 'simplepractice_exit', policy), false);
    const result = a.inject(publicHtml, route, allowed, requestedProduction, policy);
    assert.equal(result.injected, true);
    assert.equal(result.googleInjected, false);
    assert.match(result.html, /data-mft-google-mode="disabled"/);
    assert.doesNotMatch(result.html, /mft-google-measurement\.js/);
  }
  for (const event of ['page_view', 'appointment_request_click', 'clinician_schedule_click', 'consultation_click'])
    assert.equal(a.isGoogleEligible('/', event, policy), false, event);
  assert.equal(a.inject(publicHtml, '/about/', new Set(['/']), requestedProduction, policy).injected, false);
  assert.equal(a.inject(publicHtml.replace('Book', '<input>'), '/', allowed, requestedProduction, policy).injected, false);
});

test('a narrower synthetic review cannot inherit the other candidate route', () => {
  const policy = {...syntheticReviewedPolicy(), approvedRoutes:['/about/']};
  assert.equal(a.enabled(requestedProduction, policy), true);
  assert.equal(a.isGoogleEligible('/', 'simplepractice_exit', policy), false);
  const allowed = new Set(['/', '/about/']);
  assert.equal(a.inject(publicHtml, '/', allowed, requestedProduction, policy).googleInjected, false);
  assert.equal(a.inject(htmlForRoute('/about/'), '/about/', allowed, requestedProduction, policy).googleInjected, true);
});

test('reviewed flow includes the exact public document titles and cannot broaden the title scope', () => {
  const expected = {
    '/': 'Marriage.Family.Therapy | Woodinville & Online in Washington',
    '/about/': 'About Marriage.Family.Therapy | Woodinville, WA'
  };
  assert.deepEqual(a.reviewedDocumentTitles(), expected);
  for (const invalid of [null, [], {'/':expected['/']}, {...expected, '/private/':'Private'},
    {...expected, '/':'Private appointment'}, {...expected, '/about/':expected['/']}])
    assert.throws(() => a.validateReviewedDocumentTitles(invalid), /exact reviewed document titles/);
});

test('reviewed Google injection rejects missing, changed, duplicate, misplaced and quoted document titles', () => {
  const policy = syntheticReviewedPolicy();
  const allowed = new Set(['/', '/about/']);
  for (const route of allowed) {
    const input = htmlForRoute(route);
    const title = input.match(/<title>[\s\S]*?<\/title>/)[0];
    assert.equal(a.assertReviewedDocumentTitle(input, route), a.REVIEWED_DOCUMENT_TITLES[route]);
    for (const changed of [
      input.replace(title, ''),
      input.replace(title, '<title>Private clinician or intake title</title>'),
      input.replace(title, title+title),
      input.replace(title, '').replace('<body>', '<body>'+title),
      input.replace(title, '<!--'+title+'-->'),
      input.replace(title, '<script type="application/ld+json">'+JSON.stringify({title})+'</script>'),
      input.replace(title, '<template>'+title+'</template>')
    ]) assert.throws(() => a.inject(changed, route, allowed, requestedProduction, policy), /document title differs/);
  }
  // First-party-only pages do not acquire this Google-specific title constraint.
  assert.equal(a.inject('<html><head><title>Unreviewed title</title></head><body></body></html>', '/', allowed, production).googleInjected, false);
});

test('eligible public pages receive only one first-party controller with Google off under either flag value', () => {
  const allowed = new Set(['/', '/services/', '/marriage-reset-assessment/']);
  for (const ga4Flag of ['true', 'false']) {
    const home = a.inject(publicHtml, '/', allowed, {...production, GA4_BASIC_MEASUREMENT_ENABLED:ga4Flag});
    assert.equal(home.injected, true);
    assert.equal((home.html.match(/mft-analytics\.js/g) || []).length, 1);
    assert.match(home.html, /data-mft-measurement-controller="first-party"/);
    assert.match(home.html, /data-mft-google-mode="disabled"/);
    assert.match(home.html, /data-mft-handoff-endpoint="https:\/\/ops\.mft\.care\/api\/marketing\/attribution"/);
    assert.doesNotMatch(home.html, /G-BTK39BBNRE|data-mft-measurement-id|data-mft-frame-version|mft-ga4-|googletagmanager/);
    assert.throws(() => a.inject(home.html, '/', allowed, production), /refusing duplicate/);
  }
});

test('opaque page codes preserve their established identity', () => {
  assert.equal(a.pageKey('/'), '8a5edab282632443');
  assert.equal(a.pageKey('/services'), a.pageKey('/services/'));
  const key = a.pageKey('/anxiety-stress-therapy/');
  assert.match(key, /^[a-f0-9]{16}$/);
  assert.equal(key.includes('anxiety'), false);
});

test('first-party collection requires its own gate and remains excluded from preview and unpublished builds', () => {
  assert.equal(a.handoffEnabled(production), true);
  assert.equal(a.controllerEnabled(production), true);
  for (const env of [
    {...production, OPS_HANDOFF_COLLECTION_ENABLED:'false'},
    {...production, OPS_HANDOFF_COLLECTION_ENABLED:undefined, GA4_BASIC_MEASUREMENT_ENABLED:'true'},
    {...production, CONTEXT:'deploy-preview'},
    {...production, CONTEXT:'branch-deploy'},
    {...production, SITE_INDEXING_ENABLED:'false'},
    {...production, NETLIFY_PREVIEW_SERVER:'true'}
  ]) {
    assert.equal(a.handoffEnabled(env), false);
    assert.equal(a.controllerEnabled(env), false);
    assert.equal(a.inject(publicHtml, '/', new Set(['/']), env).injected, false);
  }
});

test('draft, intake, coverage, appointment and form pages cannot receive the controller', () => {
  assert.equal(a.inject(publicHtml, '/draft/', new Set(['/']), production).injected, false);
  for (const route of ['/check-my-coverage/', '/intake/', '/patient/', '/appointment/', '/marriagereset/', '/marriage-reset-assessment/', '/start/'])
    assert.equal(a.inject(publicHtml, route, new Set([route]), production).injected, false, route);
  for (const input of ['<form></form>', '<input>', '<textarea></textarea>'])
    assert.equal(a.inject('<html><body>'+input+'</body></html>', '/', new Set(['/']), production).injected, false);
});

test('Netlify production enables only first-party collection and measurement assets remain versioned', () => {
  const toml = fs.readFileSync(path.join(__dirname, '../netlify.toml'), 'utf8');
  const section = toml.match(/\[context\.production\.environment\]([\s\S]*?)(?:\n\[|$)/)?.[1];
  assert.match(section || '', /GA4_BASIC_MEASUREMENT_ENABLED = "false"/);
  assert.match(section || '', /OPS_HANDOFF_COLLECTION_ENABLED = "true"/);
  for (const context of ['deploy-preview', 'branch-deploy'])
    assert.ok(toml.includes('[context.'+context+'.environment]\n  GA4_BASIC_MEASUREMENT_ENABLED = "false"'));
  assert.match(a.assetVersion('mft-analytics.js'), /^[a-f0-9]{16}$/);
});

test('generated templates cannot retain a source-page measurement identity or retired Google script', () => {
  const tagged = a.inject(publicHtml, '/', new Set(['/']), production).html;
  assert.equal(a.strip(tagged), publicHtml);
  assert.equal(a.strip(a.strip(tagged)), publicHtml);
  for (const asset of ['mft-google-measurement', 'mft-ga4-bootstrap', 'mft-ga4-frame', 'mft-ga4-page']) {
    const inherited = publicHtml.replace('</body>', '<script src="/assets/'+asset+'.js?v=legacy" defer></script></body>');
    assert.equal(a.strip(inherited), publicHtml);
  }
});
