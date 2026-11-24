'use strict';
const fs = require('node:fs'), path = require('node:path');
const analytics = require('../src/analytics-build');
const { FINAL_VERIFIED_SCOPE } = require('../src/measurement-report');
function apply(dist) {
  const reportFile = path.join(dist, 'reports/analytics-integration.json');
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  const policy = analytics.googlePolicy();
  if (report.version !== 2 || report.enabled !== false ||
      report.measurement?.consentControlledGa4?.buildEnabled !== false ||
      report.measurement?.consentControlledGa4?.mode !== 'disabled' ||
      report.measurement?.consentControlledGa4?.runtimeEntryPoint !== null ||
      JSON.stringify(report.measurement?.consentControlledGa4?.policy) !== JSON.stringify(policy) ||
      JSON.stringify(report.allowedRoutes) !== '[]' || JSON.stringify(report.allowedEvents) !== '[]' ||
      !Array.isArray(report.injected) || new Set(report.injected).size !== report.injected.length ||
      typeof report.controllerEnabled !== 'boolean' ||
      report.measurement?.firstPartyController?.buildEnabled !== report.controllerEnabled ||
      report.measurement?.consentControlledOps?.buildEnabled !== report.controllerEnabled ||
      (!report.controllerEnabled && report.injected.length))
    throw Error('Measurement report does not match the disabled Google and independent first-party policy');
  const allowed = new Set(report.injected);
  const opsEnabled = report.measurement.consentControlledOps.buildEnabled;
  const sitemap = new Set([...fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => analytics.normalizeRoute(new URL(m[1]).pathname)));
  const headers = fs.readFileSync(path.join(dist, '_headers'), 'utf8');
  const googleHost = /\b(?:googletagmanager\.com|google-analytics\.com|googleadservices\.com|googlesyndication\.com|doubleclick\.net|google\.com|googleapis\.com|gstatic\.com)\b/i;
  if (googleHost.test(headers)) throw Error('Google hosts are not permitted by the disabled measurement CSP');
  const opsConnect = /connect-src\s[^;]*https:\/\/ops\.mft\.care(?=[\s;])/.test(headers);
  if (opsConnect !== opsEnabled) throw Error('First-party handoff CSP does not match collection state');
  const walk = d => fs.readdirSync(d, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(path.join(d,e.name)) : [path.join(d,e.name)]);
  const actual = [], stripped = [];
  for (const file of walk(dist).filter(f => f.endsWith('.html'))) {
    const rel = path.relative(dist,file).split(path.sep).join('/');
    const route = analytics.normalizeRoute('/' + rel.replace(/index\.html$/, ''));
    let html = fs.readFileSync(file, 'utf8');
    if (rel === 'assets/mft-ga4-frame.html') {
      if (!/name="robots" content="noindex,nofollow"/.test(html) ||
          /data-mft-measurement-id=|data-mft-frame-version=|data-mft-handoff-endpoint=/.test(html) ||
          googleHost.test(html) || sitemap.has(route)) throw Error('Unsafe retired analytics helper document');
      continue;
    }
    if (!allowed.has(route)) {
      const cleaned = analytics.strip(html);
      if (cleaned !== html) { fs.writeFileSync(file,cleaned); stripped.push(route); html = cleaned; }
    }
    if (googleHost.test(html) || /data-mft-measurement-id=|data-mft-frame-version=|<script\b[^>]*src=["'][^"']*mft-ga4-(?:bootstrap|frame|page)\.js|<iframe\b[^>]*mft-ga4-frame/i.test(html))
      throw Error('Google measurement is not permitted on this page: '+route);
    const controllers = [...html.matchAll(/<script\b[^>]*src="[^"]*\/mft-analytics\.js(?:\?[^"]*)?"[^>]*>/g)];
    if (!controllers.length) {
      if (/data-mft-measurement-controller=|data-mft-handoff-endpoint=/.test(html)) throw Error('Controller attributes without an installed controller: '+route);
      continue;
    }
    if (controllers.length !== 1 || !/data-mft-measurement-controller="first-party"/.test(controllers[0][0]) ||
        !/data-mft-google-mode="disabled"/.test(controllers[0][0])) throw Error('Wrong first-party controller installation: '+route);
    if (!opsEnabled || !allowed.has(route) || !sitemap.has(route) || analytics.isSensitive(route) || /<(?:form|input|textarea)\b/i.test(html)) throw Error('Unapproved first-party measurement page: '+route);
    const keys = [...html.matchAll(/data-mft-page-key="([^"]+)"/g)].map(m => m[1]);
    if (keys.length !== 1 || keys[0] !== analytics.pageKey(route)) throw Error('Wrong first-party page identity: '+route);
    const endpoints = [...html.matchAll(/data-mft-handoff-endpoint="([^"]+)"/g)].map(m => m[1]);
    if(endpoints.length!==1 || endpoints[0]!==analytics.HANDOFF_ENDPOINT)
      throw Error('Wrong first-party handoff installation: '+route);
    actual.push(route);
  }
  if (JSON.stringify(actual.sort()) !== JSON.stringify([...allowed].sort())) throw Error('Final first-party inventory does not match approved injection');
  report.finalVerified = true; report.finalVerifiedScope = FINAL_VERIFIED_SCOPE; report.finalPages = actual; report.removedInheritedTags = stripped.length;
  report.finalPagesScope = 'first-party controller only; no Google runtime';
  report.controllerPages = [...actual];
  report.opsHandoffPages = opsEnabled ? [...actual] : [];
  report.googlePages = [];
  fs.writeFileSync(reportFile, JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({verifiedFirstPartyPages: actual.length, verifiedGooglePages:0, removedInheritedTags: stripped.length}));
}
module.exports = {apply};
