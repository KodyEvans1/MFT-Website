'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const a = require('../src/analytics-build');
const production = {CONTEXT:'production', SITE_INDEXING_ENABLED:'true', GA4_BASIC_MEASUREMENT_ENABLED:'false', OPS_HANDOFF_COLLECTION_ENABLED:'true'};
const publicHtml = '<html><head></head><body><a href="https://marriagefamilytherapy.clientsecure.me/">Book</a></body></html>';

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
  assert.equal(policy.version, 1);
  assert.equal(policy.status, 'blocked-sensitive-context');
  assert.deepEqual(policy.approvedRoutes, []);
  assert.deepEqual(policy.approvedEvents, []);
  for (const route of ['/', '/services/', '/emily-johnsrud-bio/', '/gary-ashley-bio/'])
    for (const event of ['page_view', 'simplepractice_exit']) assert.equal(a.isGoogleEligible(route, event), false);
  for (const changed of [{...policy, approvedRoutes:['/']}, {...policy, approvedEvents:['simplepractice_exit']},
    {...policy, status:'approved'}, {...policy, version:2}])
    assert.throws(() => a.validateGooglePolicy(changed), /Unsupported Google measurement policy/);
  policy.approvedRoutes.push('/');
  assert.equal(a.isGoogleEligible('/', 'simplepractice_exit'), false);
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
  for (const asset of ['mft-ga4-bootstrap', 'mft-ga4-frame', 'mft-ga4-page']) {
    const inherited = publicHtml.replace('</body>', '<script src="/assets/'+asset+'.js?v=legacy" defer></script></body>');
    assert.equal(a.strip(inherited), publicHtml);
  }
});
