'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { apply } = require('../scripts/prepare-release-provenance');
const { googlePolicy, enabled } = require('../src/analytics-build');
const { measurementReport } = require('../src/measurement-report');
const production = {CONTEXT:'production', SITE_INDEXING_ENABLED:'true', GA4_BASIC_MEASUREMENT_ENABLED:'true', OPS_HANDOFF_COLLECTION_ENABLED:'true'};
const manifest = 'reports/release-provenance.json';
const now = new Date('2026-01-01T00:00:00.000Z');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const hashFile = (root, relative) => sha256(fs.readFileSync(path.join(root, relative)));
const analyticsReport = (pages, env = production, policy = googlePolicy()) => ({version:2, enabled:enabled(env, policy), finalVerified:true,
  finalPages:pages, controllerPages:pages, opsHandoffPages:pages,
  googlePages:enabled(env, policy)?[...policy.approvedRoutes]:[], measurement:measurementReport(env, policy)});

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mft-release-provenance-'));
  const write = (relative, data) => {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), {recursive:true});
    fs.writeFileSync(file, typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data));
  };
  for (const relative of ['src/booking-core.js','src/assets/mft-booking.js','src/assets/mft-analytics.js','src/assets/mft-ga4-frame.js','src/assets/mft-ga4-frame.html'])
    write(relative, 'synthetic ' + relative);
  write('content/simplepractice-booking.json', {generalUrl:'https://scheduler.example.invalid/'});
  write('content/google-measurement-policy.json', googlePolicy());
  for (const relative of ['content/google-measurement-flow.json', 'src/assets/mft-google-measurement.js'])
    write(relative, fs.readFileSync(path.join(__dirname, '..', relative)));
  write('dist/robots.txt', 'User-agent: *\nAllow: /\n');
  write('dist/_headers', '/*\n  Referrer-Policy: no-referrer\n');
  write('dist/sitemap.xml', '<urlset><url><loc>https://www.mft.care/</loc></url></urlset>');
  write('dist/index.html', '<html><body>Synthetic page</body></html>');
  write('dist/assets/mft-analytics.js', 'synthetic src/assets/mft-analytics.js');
  write('dist/reports/publication.json', {expectedSitemapUrls:['https://www.mft.care/'], generatedRoutes:[{slug:'synthetic-draft',status:'draft'}]});
  write('dist/reports/analytics-integration.json', analyticsReport(['/']));
  return {root, write, remove:() => fs.rmSync(root, {recursive:true, force:true})};
}

function reviewedFixture(env = production) {
  const f = fixture();
  const policy = {...googlePolicy(), status:'approved-reviewed-scope',
    approvedRoutes:['/', '/about/'], approvedEvents:['simplepractice_exit'],
    reason:'Synthetic provenance fixture only; not permission to publish Google measurement.',
    review:{decision:'permitted', decisionReference:'tests/synthetic-review-only-do-not-publish',
      flowSha256:hashFile(f.root, 'content/google-measurement-flow.json'),
      runtimeSha256:hashFile(f.root, 'src/assets/mft-google-measurement.js'),
      networkEvidenceSha256:sha256('Synthetic provenance evidence only')}};
  const pages = enabled(env, policy) ? ['/', '/about/'] : [];
  const report = analyticsReport(pages, env, policy);
  f.write('content/google-measurement-policy.json', policy);
  f.write('dist/about/index.html', '<html><body>Synthetic about page</body></html>');
  f.write('dist/assets/mft-google-measurement.js', fs.readFileSync(path.join(f.root, 'src/assets/mft-google-measurement.js')));
  f.write('dist/reports/analytics-integration.json', report);
  f.write('dist/reports/publication.json', {expectedSitemapUrls:pages.map(route => 'https://www.mft.care'+route), generatedRoutes:[]});
  return {...f, policy, report};
}

test('provenance records effective preview restrictions and provider declarations without leaking environment data or requiring Git', () => {
  const f = fixture();
  try {
    f.write('dist/reports/publication.json', {expectedSitemapUrls:[], generatedRoutes:[{slug:'synthetic-draft',status:'draft'}]});
    for (const flags of [{CONTEXT:'deploy-preview'}, {CONTEXT:'production',NETLIFY_PREVIEW_SERVER:'true'}]) {
      f.write('dist/reports/analytics-integration.json', analyticsReport([], {...production, ...flags}));
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
      assert.equal(report.environment.ga4RequestedByEnvironment, true);
      assert.equal(report.environment.firstPartyControllerEnabled, false);
      assert.equal(report.environment.opsHandoffEnabled, false);
      assert.equal(report.environment.previewServer, Boolean(flags.NETLIFY_PREVIEW_SERVER));
      assert.deepEqual(report.baseline, {sitemapUrls:0,analyticsPages:0,analyticsPagesScope:'Google runtime pages',firstPartyControllerPages:0,opsHandoffPages:0,generatedSeoRoutes:1,draftSeoRoutes:1});
      assert.doesNotMatch(JSON.stringify(report), /AUTH_TOKEN|PRIVATE_ACCOUNT|synthetic-secret|synthetic-private/);
    }
  } finally { f.remove(); }
});

test('manifest hashes final artifact content, changes with content, excludes itself, and leaves unavailable release IDs null', () => {
  const f = fixture();
  try {
    const first = apply({root:f.root, now, env:production});
    assert.equal(first.version, 2);
    assert.equal(first.builtAtUtc, now.toISOString());
    assert.equal(first.source.commit, null);
    assert.equal(first.source.commitSource, null);
    assert.equal(first.netlify.deployId, null);
    assert.equal(first.environment.indexingEnabled, true);
    assert.equal(first.environment.ga4Enabled, false);
    assert.equal(first.environment.ga4RequestedByEnvironment, true);
    assert.equal(first.environment.firstPartyControllerEnabled, true);
    assert.equal(first.environment.opsHandoffEnabled, true);
    assert.equal(first.baseline.analyticsPages, 0);
    assert.equal(first.baseline.firstPartyControllerPages, 1);
    assert.equal(first.baseline.opsHandoffPages, 1);
    assert.equal(first.googleMeasurement.mode, 'disabled');
    assert.equal(first.googleMeasurement.status, 'blocked-sensitive-context');
    assert.equal(first.googleMeasurement.policyVersion, 2);
    assert.equal(first.googleMeasurement.policyFile, 'content/google-measurement-policy.json');
    assert.match(first.googleMeasurement.policySha256, /^[a-f0-9]{64}$/);
    assert.equal(first.googleMeasurement.policySha256, hashFile(f.root, 'content/google-measurement-policy.json'));
    assert.equal(first.googleMeasurement.proposedFlowFile, 'content/google-measurement-flow.json');
    assert.equal(first.googleMeasurement.proposedFlowSha256, hashFile(f.root, 'content/google-measurement-flow.json'));
    assert.equal(first.googleMeasurement.conditionalRuntimeSha256, hashFile(f.root, 'src/assets/mft-google-measurement.js'));
    assert.equal(first.assetVersions.conditionalGoogleRuntime, first.googleMeasurement.conditionalRuntimeSha256.slice(0,16));
    assert.equal(first.googleMeasurement.reviewedNetworkEvidenceSha256, null);
    assert.equal(first.googleMeasurement.approvedRoutes, 0);
    assert.equal(first.googleMeasurement.approvedEvents, 0);
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

test('blocked provenance fingerprints changed candidate bytes without converting them into approval', () => {
  const f = fixture();
  try {
    const first = apply({root:f.root, now, env:production});
    f.write('content/google-measurement-flow.json', Buffer.concat([
      fs.readFileSync(path.join(f.root, 'content/google-measurement-flow.json')), Buffer.from('\n')
    ]));
    f.write('src/assets/mft-google-measurement.js', 'Synthetic unapproved changed runtime');
    const second = apply({root:f.root, now, env:production});
    assert.notEqual(second.googleMeasurement.proposedFlowSha256, first.googleMeasurement.proposedFlowSha256);
    assert.notEqual(second.googleMeasurement.conditionalRuntimeSha256, first.googleMeasurement.conditionalRuntimeSha256);
    assert.notEqual(second.assetVersions.conditionalGoogleRuntime, first.assetVersions.conditionalGoogleRuntime);
    assert.equal(second.googleMeasurement.mode, 'disabled');
    assert.equal(second.googleMeasurement.reviewedNetworkEvidenceSha256, null);
    assert.equal(second.environment.ga4Enabled, false);
    assert.equal(second.baseline.analyticsPages, 0);
  } finally { f.remove(); }
});

test('synthetic reviewed provenance reports the exact runtime, flow and evidence hashes without claiming Google receipt', () => {
  const f = reviewedFixture();
  try {
    const report = apply({root:f.root, now, env:production});
    assert.equal(report.version, 2);
    assert.equal(report.environment.ga4Enabled, true);
    assert.equal(report.googleMeasurement.mode, 'approved-main-page');
    assert.equal(report.googleMeasurement.status, 'approved-reviewed-scope');
    assert.equal(report.googleMeasurement.approvedRoutes, 2);
    assert.equal(report.googleMeasurement.approvedEvents, 1);
    assert.equal(report.googleMeasurement.proposedFlowSha256, f.policy.review.flowSha256);
    assert.equal(report.googleMeasurement.conditionalRuntimeSha256, f.policy.review.runtimeSha256);
    assert.equal(report.googleMeasurement.reviewedNetworkEvidenceSha256, f.policy.review.networkEvidenceSha256);
    assert.equal(report.assetVersions.conditionalGoogleRuntime, f.policy.review.runtimeSha256.slice(0,16));
    assert.equal(report.artifacts['assets/mft-google-measurement.js'].sha256, f.policy.review.runtimeSha256);
    assert.equal(report.baseline.analyticsPages, 2);
    assert.match(report.evidenceScope, /not live deployment, Google receipt, or appointment verification/);
  } finally { f.remove(); }
});

test('a reviewed source policy cannot activate provenance in a preview', () => {
  const env = {...production, CONTEXT:'deploy-preview'};
  const f = reviewedFixture(env);
  try {
    const report = apply({root:f.root, now, env});
    assert.equal(report.googleMeasurement.status, 'approved-reviewed-scope');
    assert.equal(report.googleMeasurement.mode, 'disabled');
    assert.equal(report.environment.ga4RequestedByEnvironment, true);
    assert.equal(report.environment.ga4Enabled, false);
    assert.equal(report.environment.indexingEnabled, false);
    assert.equal(report.baseline.analyticsPages, 0);
    assert.equal(report.baseline.firstPartyControllerPages, 0);
  } finally { f.remove(); }
});

test('provenance rejects reviewed source bytes changed under the supplied release root', () => {
  for (const relative of ['content/google-measurement-flow.json', 'src/assets/mft-google-measurement.js']) {
    const f = reviewedFixture();
    try {
      f.write(relative, Buffer.concat([fs.readFileSync(path.join(f.root, relative)), Buffer.from('\n')]));
      assert.throws(() => apply({root:f.root, now, env:production}), /source bytes differ from the reviewed/, relative);
      assert.equal(fs.existsSync(path.join(f.root, 'dist', manifest)), false);
    } finally { f.remove(); }
  }
});

test('provenance refuses incomplete or contradictory reviewed analytics inventories', () => {
  const cases = [
    ['unfinished validation', report => { report.finalVerified = false; }],
    ['disabled report', report => { report.enabled = false; }],
    ['missing reviewed route', report => { report.googlePages = ['/']; }],
    ['additional unreviewed route', report => { report.googlePages.push('/gary-ashley-bio/'); }],
    ['different embedded policy', report => { report.measurement.consentControlledGa4.policy = googlePolicy(); }]
  ];
  for (const [label, mutate] of cases) {
    const f = reviewedFixture();
    try {
      mutate(f.report);
      f.write('dist/reports/analytics-integration.json', f.report);
      assert.throws(() => apply({root:f.root, now, env:production}), /requires completed publication and analytics reports/, label);
      assert.equal(fs.existsSync(path.join(f.root, 'dist', manifest)), false);
    } finally { f.remove(); }
  }
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
