'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { indexingEnabled } = require('../src/seo-safety');
const { enabled: ga4Enabled, googleRequested, controllerEnabled, handoffEnabled,
  GOOGLE_POLICY_FILE, validateGooglePolicy } = require('../src/analytics-build');

const MANIFEST = 'reports/release-provenance.json';
const commitValue = value => /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(value || '') ? value.toLowerCase() : null;
const sha256 = (...values) => values.reduce((hash, value) => hash.update(value), createHash('sha256')).digest('hex');

function localGit(root) {
  const run = args => spawnSync('git', ['-C', root, ...args], {encoding:'utf8', stdio:['ignore','pipe','ignore'], timeout:5000});
  const unavailable = {head:null, state:'unavailable'};
  const top = run(['rev-parse', '--show-toplevel']);
  if (top.status !== 0) return unavailable;
  try { if (fs.realpathSync(top.stdout.trim()) !== fs.realpathSync(root)) return unavailable; }
  catch { return unavailable; }
  const head = run(['rev-parse', 'HEAD']);
  // Include tracked and untracked handwritten files, excluding generated output.
  const status = run(['status', '--porcelain=v1', '--untracked-files=all', '--', '.', ':(exclude)dist']);
  return {head:head.status === 0 ? commitValue(head.stdout.trim()) : null,
    state:status.status === 0 ? (status.stdout.trim() ? 'dirty' : 'clean') : 'unavailable'};
}

function apply({root = path.resolve(__dirname, '..'), env = process.env, now = new Date()} = {}) {
  const dist = path.join(root, 'dist');
  const read = relative => fs.readFileSync(path.join(root, relative));
  const json = relative => JSON.parse(fs.readFileSync(path.join(dist, relative), 'utf8'));
  const publication = json('reports/publication.json');
  const analytics = json('reports/analytics-integration.json');
  const policyBytes = read(GOOGLE_POLICY_FILE);
  const policy = validateGooglePolicy(JSON.parse(policyBytes.toString('utf8')));
  if (!Array.isArray(publication.expectedSitemapUrls) || !Array.isArray(publication.generatedRoutes) ||
      !Array.isArray(analytics.finalPages) || !Array.isArray(analytics.controllerPages) ||
      !Array.isArray(analytics.opsHandoffPages) || !Array.isArray(analytics.googlePages) ||
      analytics.googlePages.length !== 0 || analytics.enabled !== false ||
      analytics.finalVerified !== true ||
      JSON.stringify(analytics.measurement?.consentControlledGa4?.policy) !== JSON.stringify(policy))
    throw Error('Release provenance requires completed publication and analytics reports');

  const git = localGit(root);
  const providerKey = ['COMMIT_REF', 'GITHUB_SHA'].find(key => commitValue(env[key]));
  const providerCommit = providerKey ? commitValue(env[providerKey]) : null;
  const context = String(env.CONTEXT || '').trim().toLowerCase();
  const files = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, {withFileTypes:true})) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile()) files.push(path.relative(dist, file).split(path.sep).join('/'));
      else throw Error('Unsupported build artifact type');
    }
  }
  walk(dist);
  const artifacts = {};
  for (const relative of files.sort().filter(relative => relative !== MANIFEST)) {
    const bytes = fs.readFileSync(path.join(dist, relative));
    artifacts[relative] = {sha256:sha256(bytes), bytes:bytes.length};
  }
  // Match the address derivations in analytics-build.js and booking-build.js.
  // The artifact map independently hashes the final published bytes.
  const versions = {
    analyticsController:sha256(read('src/assets/mft-analytics.js')).slice(0,16),
    ga4Helper:sha256(read('src/assets/mft-ga4-frame.js'), read('src/assets/mft-ga4-frame.html')).slice(0,16),
    ga4HelperScript:sha256(read('src/assets/mft-ga4-frame.js')).slice(0,16),
    booking:sha256(read('src/booking-core.js'), read('src/assets/mft-booking.js'),
      JSON.stringify(JSON.parse(read('content/simplepractice-booking.json').toString('utf8')))).slice(0,16)
  };
  const report = {
    version:2,
    builtAtUtc:now.toISOString(),
    evidenceScope:'generated build artifacts; not live deployment, Google receipt, or appointment verification',
    source:{
      commit:providerCommit || git.head,
      commitSource:providerKey || (git.head ? 'local-git' : null),
      providerDeclaredCommit:providerCommit,
      localGit:git,
      providerCommitMatchesLocalHead:providerCommit && git.head ? providerCommit === git.head : null
    },
    netlify:{deployId:/^[A-Za-z0-9_-]{1,128}$/.test(env.DEPLOY_ID || '') ? env.DEPLOY_ID : null},
    environment:{
      context:['production','deploy-preview','branch-deploy','local'].includes(context) ? context : context ? 'other' : null,
      productionContext:context === 'production',
      indexingEnabled:indexingEnabled(env),
      ga4Enabled:ga4Enabled(env),
      ga4RequestedByEnvironment:googleRequested(env),
      firstPartyControllerEnabled:controllerEnabled(env),
      opsHandoffEnabled:handoffEnabled(env),
      previewServer:Boolean(env.NETLIFY_PREVIEW_SERVER)
    },
    googleMeasurement:{
      mode:'disabled',
      policyFile:GOOGLE_POLICY_FILE,
      policySha256:sha256(policyBytes),
      policyVersion:policy.version,
      status:policy.status,
      approvedRoutes:policy.approvedRoutes.length,
      approvedEvents:policy.approvedEvents.length
    },
    baseline:{
      sitemapUrls:publication.expectedSitemapUrls.length,
      analyticsPages:analytics.googlePages.length,
      analyticsPagesScope:'Google runtime pages',
      firstPartyControllerPages:analytics.controllerPages.length,
      opsHandoffPages:analytics.opsHandoffPages.length,
      generatedSeoRoutes:publication.generatedRoutes.length,
      draftSeoRoutes:publication.generatedRoutes.filter(route => route.status === 'draft').length
    },
    assetVersions:versions,
    artifactScope:'all dist files except this manifest',
    artifactCount:Object.keys(artifacts).length,
    artifacts
  };
  fs.writeFileSync(path.join(dist, MANIFEST), JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (require.main === module) {
  const report = apply();
  console.log(JSON.stringify({releaseProvenance:MANIFEST, artifacts:report.artifactCount, sourceState:report.source.localGit.state}));
}
module.exports = {apply};
