'use strict';
const fs = require('node:fs'), path = require('node:path');
const analytics = require('../src/analytics-build');
function apply(dist) {
  const reportFile = path.join(dist, 'reports/analytics-integration.json');
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  const allowed = new Set(report.injected);
  const sitemap = new Set([...fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => analytics.normalizeRoute(new URL(m[1]).pathname)));
  const walk = d => fs.readdirSync(d, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(path.join(d,e.name)) : [path.join(d,e.name)]);
  const actual = [], stripped = [];
  for (const file of walk(dist).filter(f => f.endsWith('.html'))) {
    const rel = path.relative(dist,file).split(path.sep).join('/');
    const route = analytics.normalizeRoute('/' + rel.replace(/index\.html$/, ''));
    let html = fs.readFileSync(file, 'utf8');
    if (rel === 'assets/mft-ga4-frame.html') {
      if (!/name="robots" content="noindex,nofollow"/.test(html) || /data-mft-measurement-id=|googletagmanager\.com/.test(html) || sitemap.has(route)) throw Error('Unsafe analytics helper document');
      continue;
    }
    if (!allowed.has(route)) {
      const cleaned = analytics.strip(html);
      if (cleaned !== html) { fs.writeFileSync(file,cleaned); stripped.push(route); html = cleaned; }
    }
    if (!/data-mft-measurement-id=/.test(html)) continue;
    if (!allowed.has(route) || !sitemap.has(route) || analytics.isSensitive(route) || /<(?:form|input|textarea)\b/i.test(html)) throw Error('Unapproved analytics page: '+route);
    const keys = [...html.matchAll(/data-mft-page-key="([^"]+)"/g)].map(m => m[1]);
    if (keys.length !== 1 || keys[0] !== analytics.pageKey(route)) throw Error('Wrong analytics page identity: '+route);
    actual.push(route);
  }
  if (JSON.stringify(actual.sort()) !== JSON.stringify([...allowed].sort())) throw Error('Final analytics inventory does not match approved injection');
  report.finalVerified = true; report.finalPages = actual; report.removedInheritedTags = stripped.length;
  fs.writeFileSync(reportFile, JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({verifiedAnalyticsPages: actual.length, removedInheritedTags: stripped.length}));
}
module.exports = {apply};
