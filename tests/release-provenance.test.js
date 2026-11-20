'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { apply } = require('../scripts/prepare-release-provenance');
const production = {CONTEXT:'production', SITE_INDEXING_ENABLED:'true', GA4_BASIC_MEASUREMENT_ENABLED:'true'};
const manifest = 'reports/release-provenance.json';
const now = new Date('2026-01-01T00:00:00.000Z');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mft-release-provenance-'));
  const write = (relative, data) => {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), {recursive:true});
    fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data));
  };
  for (const relative of ['src/booking-core.js','src/assets/mft-booking.js','src/assets/mft-analytics.js','src/assets/mft-ga4-frame.js','src/assets/mft-ga4-frame.html'])
    write(relative, 'synthetic ' + relative);
  write('content/simplepractice-booking.json', {generalUrl:'https://scheduler.example.invalid/'});
  write('dist/robots.txt', 'User-agent: *\nAllow: /\n');
  write('dist/_headers', '/*\n  Referrer-Policy: no-referrer\n');
  write('dist/sitemap.xml', '<urlset><url><loc>https://www.mft.care/</loc></url></urlset>');
  write('dist/index.html', '<html><body>Synthetic page</body></html>');
  write('dist/assets/mft-analytics.js', 'synthetic src/assets/mft-analytics.js');
  write('dist/reports/publication.json', {expectedSitemapUrls:['https://www.mft.care/'], generatedRoutes:[{slug:'synthetic-draft',status:'draft'}]});
  write('dist/reports/analytics-integration.json', {finalVerified:true, finalPages:['/']});
  return {root, write, remove:() => fs.rmSync(root, {recursive:true, force:true})};
}

test('provenance records effective preview restrictions and provider declarations without leaking environment data or requiring Git', () => {
  const f = fixture();
  try {
    f.write('dist/reports/publication.json', {expectedSitemapUrls:[], generatedRoutes:[{slug:'synthetic-draft',status:'draft'}]});
    f.write('dist/reports/analytics-integration.json', {finalVerified:true, finalPages:[]});
    for (const flags of [{CONTEXT:'deploy-preview'}, {CONTEXT:'production',NETLIFY_PREVIEW_SERVER:'true'}]) {
      const report = apply({root:f.root, now, env:{...production, ...flags,
        COMMIT_REF:'a'.repeat(40), GITHUB_SHA:'b'.repeat(40), DEPLOY_ID:'0123456789abcdef01234567',
        AUTH_TOKEN:'synthetic-secret-token', PRIVATE_ACCOUNT:'synthetic-private-account'}});
      assert.equal(report.source.commit, 'a'.repeat(40));
      assert.equal(report.source.commitSource, 'COMMIT_REF');
      assert.equal(report.source.providerDeclaredCommit, 'a'.repeat(40));
      assert.deepEqual(report.source.localGit, {head:null,state:'unavailable'});
      assert.equal(report.source.providerCommitMatchesLocalHead, null);
      assert.equal(report.netlify.deployId, '0123456789abcdef01234567');
      assert.equal(report.environment.indexingEnabled, false);
      assert.equal(report.environment.ga4Enabled, false);
      assert.equal(report.environment.previewServer, Boolean(flags.NETLIFY_PREVIEW_SERVER));
      assert.deepEqual(report.baseline, {sitemapUrls:0,analyticsPages:0,generatedSeoRoutes:1,draftSeoRoutes:1});
      assert.doesNotMatch(JSON.stringify(report), /AUTH_TOKEN|PRIVATE_ACCOUNT|synthetic-secret|synthetic-private/);
    }
  } finally { f.remove(); }
});

test('manifest hashes final artifact content, changes with content, excludes itself, and leaves unavailable release IDs null', () => {
  const f = fixture();
  try {
    const first = apply({root:f.root, now, env:production});
    assert.equal(first.builtAtUtc, now.toISOString());
    assert.equal(first.source.commit, null);
    assert.equal(first.source.commitSource, null);
    assert.equal(first.netlify.deployId, null);
    assert.equal(first.environment.indexingEnabled, true);
    assert.equal(first.environment.ga4Enabled, true);
    assert.equal(first.artifacts[manifest], undefined);
    assert.equal(first.artifactCount, Object.keys(first.artifacts).length);
    for (const relative of ['robots.txt','_headers','sitemap.xml','index.html','assets/mft-analytics.js','reports/publication.json','reports/analytics-integration.json']) {
      assert.match(first.artifacts[relative].sha256, /^[a-f0-9]{64}$/);
      assert.equal(first.artifacts[relative].bytes, fs.statSync(path.join(f.root,'dist',relative)).size);
    }
    f.write('src/assets/mft-analytics.js', 'updated synthetic controller');
    f.write('dist/assets/mft-analytics.js', 'updated synthetic controller');
    const second = apply({root:f.root, now, env:production});
    assert.notEqual(second.artifacts['assets/mft-analytics.js'].sha256, first.artifacts['assets/mft-analytics.js'].sha256);
    assert.notEqual(second.assetVersions.analyticsController, first.assetVersions.analyticsController);
    assert.equal(second.artifactCount, first.artifactCount);
    assert.equal(second.artifacts[manifest], undefined);
    assert.deepEqual(second.artifacts['index.html'], first.artifacts['index.html']);
  } finally { f.remove(); }
});

test('source identity separates Git HEAD and provider declarations while ignoring dist and detecting untracked handwritten files', () => {
  const f = fixture();
  const git = args => execFileSync('git', ['-C',f.root,...args], {encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
  try {
    git(['init','-q']);
    git(['add','.']);
    git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','Synthetic fixture']);
    const head = git(['rev-parse','HEAD']);
    const first = apply({root:f.root, now, env:production});
    assert.equal(first.source.commit, head);
    assert.equal(first.source.commitSource, 'local-git');
    assert.deepEqual(first.source.localGit, {head,state:'clean'});
    f.write('dist/robots.txt', 'updated synthetic output');
    f.write('dist/untracked-output.txt', 'synthetic generated output');
    assert.equal(apply({root:f.root, now, env:production}).source.localGit.state, 'clean');
    for (const directory of ['src','scripts','tests','content','reports']) {
      const relative = directory + '/untracked-handwritten.txt';
      f.write(relative, 'synthetic source');
      assert.equal(apply({root:f.root, now, env:production}).source.localGit.state, 'dirty', directory);
      fs.rmSync(path.join(f.root,relative));
    }
    const declared = apply({root:f.root, now, env:{...production,COMMIT_REF:'0'.repeat(40)}});
    assert.equal(declared.source.commitSource, 'COMMIT_REF');
    assert.equal(declared.source.commit, '0'.repeat(40));
    assert.equal(declared.source.localGit.head, head);
    assert.equal(declared.source.localGit.state, 'clean');
    assert.equal(declared.source.providerCommitMatchesLocalHead, false);
  } finally { f.remove(); }
});
