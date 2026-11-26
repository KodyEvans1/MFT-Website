'use strict';
const fs = require('node:fs'), path = require('node:path');
const analytics = require('../src/analytics-build');
const csp = require('../src/google-measurement-csp');
const { FINAL_VERIFIED_SCOPE } = require('../src/measurement-report');
function apply(dist, policy = analytics.googlePolicy()) {
  analytics.validateGooglePolicy(policy);
  const reportFile = path.join(dist, 'reports/analytics-integration.json');
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  const google = policy.status === 'approved-reviewed-scope' && report.controllerEnabled === true &&
    report.measurement?.consentControlledGa4?.requestedByEnvironment === true;
  const mode = google ? analytics.GOOGLE_RUNTIME_MODE : 'disabled';
  if (report.version !== 2 || report.enabled !== google ||
      report.measurement?.consentControlledGa4?.buildEnabled !== google ||
      report.measurement?.consentControlledGa4?.mode !== mode ||
      report.measurement?.consentControlledGa4?.runtimeEntryPoint !== (google ? 'MFTGoogleMeasurement.handoff' : null) ||
      JSON.stringify(report.measurement?.consentControlledGa4?.policy) !== JSON.stringify(policy) ||
      JSON.stringify(report.allowedRoutes) !== JSON.stringify(policy.approvedRoutes) ||
      JSON.stringify(report.allowedEvents) !== JSON.stringify(policy.approvedEvents) ||
      !Array.isArray(report.injected) || new Set(report.injected).size !== report.injected.length ||
      typeof report.controllerEnabled !== 'boolean' ||
      report.measurement?.firstPartyController?.buildEnabled !== report.controllerEnabled ||
      report.measurement?.consentControlledOps?.buildEnabled !== report.controllerEnabled ||
      (!report.controllerEnabled && report.injected.length))
    throw Error('Measurement report does not match the explicit Google and independent first-party policy');
  const allowed = new Set(report.injected);
  const opsEnabled = report.measurement.consentControlledOps.buildEnabled;
  const sitemap = new Set([...fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => analytics.normalizeRoute(new URL(m[1]).pathname)));
  const headers = fs.readFileSync(path.join(dist, '_headers'), 'utf8');
  const googleHost = /\b(?:googletagmanager\.com|google-analytics\.com|googleadservices\.com|googlesyndication\.com|doubleclick\.net|google\.com|googleapis\.com|gstatic\.com)\b/i;
  if (!google && googleHost.test(headers)) throw Error('Google hosts are not permitted by the disabled measurement CSP');
  let restrictedPolicy = null;
  if (google) {
    const restrictedHeaders = csp.removeGooglePermission(headers);
    restrictedPolicy = csp.headerPolicy(restrictedHeaders);
    if (googleHost.test(restrictedHeaders) || csp.permitGoogle(restrictedHeaders).headers !== headers ||
        !/Referrer-Policy:\s*no-referrer(?:\r?\n|$)/.test(headers))
      throw Error('Google CSP or referrer boundary differs from the reviewed destinations');
  }
  const opsConnect = /connect-src\s[^;]*https:\/\/ops\.mft\.care(?=[\s;])/.test(headers);
  if (opsConnect !== opsEnabled) throw Error('First-party handoff CSP does not match collection state');
  const walk = d => fs.readdirSync(d, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(path.join(d,e.name)) : [path.join(d,e.name)]);
  const actual = [], googleActual = [], stripped = [];
  for (const file of walk(dist).filter(f => f.endsWith('.html'))) {
    const rel = path.relative(dist,file).split(path.sep).join('/');
    const route = analytics.normalizeRoute('/' + rel.replace(/index\.html$/, ''));
    const googleEligible = google && analytics.isGoogleEligible(route, analytics.GOOGLE_EVENT, policy);
    let html = fs.readFileSync(file, 'utf8');
    if (!allowed.has(route)) {
      const cleaned = analytics.strip(html);
      if (cleaned !== html) { fs.writeFileSync(file,cleaned); stripped.push(route); html = cleaned; }
    }
    if (google && !googleEligible) {
      const expectedMeta = csp.restrictedMeta(restrictedPolicy);
      if (!html.includes(csp.META_MARKER)) {
        html = csp.restrictHtml(html, restrictedPolicy);
        fs.writeFileSync(file, html);
      }
      const head = html.match(/<head(?:\s[^>]*)?>([\s\S]*)/i)?.[1];
      if (!head?.startsWith(expectedMeta) || (html.match(/data-mft-google-denied=/g) || []).length !== 1)
        throw Error('Excluded page lacks its strict Google CSP: '+route);
    }
    if (rel === 'assets/mft-ga4-frame.html') {
      if (!/name="robots" content="noindex,nofollow"/.test(html) ||
          /data-mft-measurement-id=|data-mft-frame-version=|data-mft-handoff-endpoint=|data-mft-google-approved-review=/.test(html) ||
          googleHost.test(html) || sitemap.has(route)) throw Error('Unsafe retired analytics helper document');
      continue;
    }
    if (googleHost.test(html) || /data-mft-measurement-id=|data-mft-frame-version=|<script\b[^>]*src=["'][^"']*mft-ga4-(?:bootstrap|frame|page)\.js|<iframe\b[^>]*mft-ga4-frame/i.test(html))
      throw Error('Direct or retired Google measurement is not permitted on this page: '+route);
    const googleTags = [...html.matchAll(/<script\b[^>]*src="[^"]*\/mft-google-measurement\.js(?:\?[^"]*)?"[^>]*>/g)];
    if (googleEligible) {
      const expected = '<script src="/assets/'+analytics.GOOGLE_RUNTIME_ASSET+'?v='+analytics.assetVersion(analytics.GOOGLE_RUNTIME_ASSET)+
        '" defer data-mft-google-mode="'+analytics.GOOGLE_RUNTIME_MODE+'" data-mft-google-measurement-id="'+analytics.MEASUREMENT_ID+
        '" data-mft-google-route="'+route+'" data-mft-google-event="'+analytics.GOOGLE_EVENT+
        '" data-mft-google-approved-review="'+analytics.googleReviewDigest(policy)+'">';
      if (googleTags.length !== 1 || googleTags[0][0] !== expected ||
          html.indexOf(expected) > html.indexOf('<script src="/assets/mft-analytics.js') || html.includes(csp.META_MARKER))
        throw Error('Wrong conditional Google runtime installation: '+route);
      googleActual.push(route);
    } else if (googleTags.length || /data-mft-google-(?:measurement-id|route|event|approved-review)=/.test(html)) {
      throw Error('Google runtime outside the reviewed scope: '+route);
    }
    const controllers = [...html.matchAll(/<script\b[^>]*src="[^"]*\/mft-analytics\.js(?:\?[^"]*)?"[^>]*>/g)];
    if (!controllers.length) {
      if (/data-mft-measurement-controller=|data-mft-handoff-endpoint=/.test(html)) throw Error('Controller attributes without an installed controller: '+route);
      continue;
    }
    if (controllers.length !== 1 || !/data-mft-measurement-controller="first-party"/.test(controllers[0][0]) ||
        !controllers[0][0].includes('data-mft-google-mode="'+(googleEligible ? mode : 'disabled')+'"'))
      throw Error('Wrong first-party controller installation: '+route);
    if (!opsEnabled || !allowed.has(route) || !sitemap.has(route) || analytics.isSensitive(route) || /<(?:form|input|textarea)\b/i.test(html)) throw Error('Unapproved first-party measurement page: '+route);
    const keys = [...html.matchAll(/data-mft-page-key="([^"]+)"/g)].map(m => m[1]);
    if (keys.length !== 1 || keys[0] !== analytics.pageKey(route)) throw Error('Wrong first-party page identity: '+route);
    const endpoints = [...html.matchAll(/data-mft-handoff-endpoint="([^"]+)"/g)].map(m => m[1]);
    if(endpoints.length!==1 || endpoints[0]!==analytics.HANDOFF_ENDPOINT)
      throw Error('Wrong first-party handoff installation: '+route);
    actual.push(route);
  }
  if (JSON.stringify(actual.sort()) !== JSON.stringify([...allowed].sort())) throw Error('Final first-party inventory does not match approved injection');
  if (JSON.stringify(googleActual.sort()) !== JSON.stringify(google ? [...policy.approvedRoutes].sort() : []))
    throw Error('Final Google inventory does not match the reviewed routes');
  report.finalVerified = true; report.finalVerifiedScope = FINAL_VERIFIED_SCOPE; report.finalPages = actual; report.removedInheritedTags = stripped.length;
  report.finalPagesScope = 'first-party controller inventory; Google inventory is reported separately';
  report.controllerPages = [...actual];
  report.opsHandoffPages = opsEnabled ? [...actual] : [];
  report.googlePages = googleActual;
  fs.writeFileSync(reportFile, JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({verifiedFirstPartyPages:actual.length, verifiedGooglePages:googleActual.length, removedInheritedTags:stripped.length}));
}
module.exports = {apply};
