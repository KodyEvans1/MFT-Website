'use strict';
// Real repository inputs, isolated build directories. Never publishes a deployment.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const results = [];
for (const [name, flag, context, googleFlag, opsFlag] of [
  ['preview-default', 'false', 'deploy-preview', 'false', 'false'],
  ['preview-accidental-enable', 'true', 'deploy-preview', 'true', 'true'],
  ['production-policy-rehearsal', 'true', 'production', 'false', 'true'],
  ['production-google-flag-misconfigured', 'true', 'production', 'true', 'true']
]) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'mft-full-site-'));
  try {
    for (const dir of ['src', 'scripts', 'content', 'reports'])
      fs.cpSync(path.join(root, dir), path.join(work, dir), { recursive: true });
    const env = { ...process.env, SITE_INDEXING_ENABLED: flag, CONTEXT: context,
      GA4_BASIC_MEASUREMENT_ENABLED:googleFlag, OPS_HANDOFF_COLLECTION_ENABLED:opsFlag };
    delete env.NETLIFY_PREVIEW_SERVER;
    const build = spawnSync(process.execPath, ['scripts/build-site.js'], {
      cwd: work, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 120000
    });
    if (build.error || build.status !== 0) throw new Error(`${name} failed: ${build.error?.message || ''}\n${build.stderr}\n${build.stdout}`);
    const read = name => JSON.parse(fs.readFileSync(path.join(work, 'dist/reports', name), 'utf8'));
    const publication = read('publication.json'), validation = read('validation.json'), expansion = read('seo-expansion.json'), analytics = read('analytics-integration.json');
    assert.deepEqual(validation.errors, []);
    assert.equal(analytics.enabled, false);
    assert.deepEqual(analytics.allowedRoutes, []);
    assert.deepEqual(analytics.allowedEvents, []);
    assert.deepEqual(analytics.googlePages, []);
    assert.equal(analytics.measurement.consentControlledGa4.policy.status, 'blocked-sensitive-context');
    assert.doesNotMatch(fs.readFileSync(path.join(work, 'dist/_headers'), 'utf8'), /googletagmanager|google-analytics|googleadservices|doubleclick/);
    assert.equal(publication.indexingEnabled, context === 'production');
    assert.equal(new Set(publication.preservedRoutes.map(x => x.slug)).size, publication.preservedRoutes.length);
    if (context !== 'production') {
      assert.equal(publication.expectedSitemapUrls.length, 0);
      assert.equal(analytics.injected.length, 0);
      assert.equal(analytics.opsHandoffPages.length, 0);
    } else {
      assert.ok(publication.expectedSitemapUrls.length > 0);
      assert.ok(analytics.injected.length > 0);
      assert.equal(analytics.controllerEnabled, true);
      assert.deepEqual(analytics.controllerPages, analytics.opsHandoffPages);
      assert.equal(analytics.measurement.consentControlledGa4.requestedByEnvironment, googleFlag === 'true');
      assert.equal(analytics.injected.includes('/marriage-reset-assessment/'), false);
      const normalize = p => p === '/' ? '/' : (p.endsWith('/') ? p : p + '/');
      const approvedPaths = new Set(publication.expectedSitemapUrls.map(url => normalize(new URL(url).pathname)));
      for (const route of analytics.injected) assert.ok(approvedPaths.has(normalize(route)), 'first-party route must be sitemap-approved: ' + route);
    }
    results.push({ name, status: 'pass', environment: 'isolated CI build only',
      htmlFiles: validation.htmlFiles, sitemapUrls: validation.sitemapUrls,
      firstPartyControllerPages:analytics.controllerPages.length, googlePages:analytics.googlePages.length,
      generatedPages: expansion.generatedPages, approvedExpansionPages: expansion.approved,
      preservedCorePages: expansion.preservedCorePages, warningCount: validation.warningCount });
    console.log(JSON.stringify(results.at(-1)));
  } finally { fs.rmSync(work, { recursive: true, force: true }); }
}
fs.mkdirSync(path.join(root, 'dist/reports'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/reports/publication-rehearsal.json'), JSON.stringify({ results }, null, 2) + '\n');
