'use strict';
// Independent output checks: authored content must not silently fall back to a template.
const fs = require('node:fs');
const path = require('node:path');
const { createLibrary, digest, esc } = require('./editorial-library');
const { indexingEnabled, robotsFor, SITE } = require('./seo-safety');
const { config } = require('./booking-build');
function validateEditorial(dist) {
  const errors = [];
  try {
    const content = require('../content/editorial-library.json');
    const evidence = require('../content/clinician-evidence.json');
    const publication = JSON.parse(fs.readFileSync(path.join(dist, 'reports/publication.json'), 'utf8'));
    const generated = new Set(publication.generatedRoutes.map(e => e.slug));
    const coreSlugs = fs.readdirSync(dist, { withFileTypes: true }).filter(e => e.isDirectory() && !generated.has(e.name) && fs.existsSync(path.join(dist, e.name, 'index.html'))).map(e => e.name);
    const ctx = createLibrary({ content, evidence, registry: require('../content/seo-registry.json'), clinicians: require('../content/clinician-registry.json'), coreSlugs, production: process.env.CONTEXT === 'production' || indexingEnabled() });
    const report = JSON.parse(fs.readFileSync(path.join(dist, 'reports/editorial-library.json'), 'utf8'));
    if (report.articleCount !== ctx.articles.size || report.articles.length !== ctx.articles.size) errors.push('Editorial report count mismatch');
    if (new Set(report.articles.map(a => a.slug)).size !== ctx.articles.size) errors.push('Editorial report has duplicate/missing routes');
    for (const a of ctx.articles.values()) {
      const html = fs.readFileSync(path.join(dist, a.slug, 'index.html'), 'utf8');
      const main = html.match(/<main\b[^>]*>[\s\S]*?<\/main>/)?.[0] || '';
      const check = (ok, message) => { if (!ok) errors.push(a.slug + ': ' + message); };
      check(main.includes('data-editorial-article="' + a.slug + '"'), 'Authored renderer missing');
      check(html.includes('<title>' + esc(a.title) + '</title>'), 'Wrong authored title');
      check(html.includes('name="description" content="' + esc(a.summary) + '"'), 'Wrong authored description');
      check(html.includes('rel="canonical" href="' + SITE + '/' + a.slug + '/"'), 'Wrong editorial canonical');
      check(html.includes('name="robots" content="' + robotsFor(a.status) + '"'), 'Wrong editorial publication policy');
      check(report.articles.find(r => r.slug === a.slug)?.revisionHash === digest(a, content, evidence), 'Stale report/revision');
      const ids = [...main.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
      check(new Set(ids).size === ids.length, 'Duplicate content anchors');
      for (const m of main.matchAll(/href="#([^"]+)"/g)) check(ids.includes(m[1]), 'Missing anchor ' + m[1]);
      for (const s of a.sections) {
        check(main.includes('id="' + s.id + '"'), 'Missing section ' + s.id);
        for (const p of s.paragraphs) check(main.includes(esc(p)), 'Missing authored paragraph in ' + s.id);
      }
      check(!/<form\b|<input\b|<textarea\b/i.test(main), 'Unexpected public data collection');
      check(!/story-section seo-entity|Connected care library/.test(main), 'Inherited generic content');
      if (a.status !== 'approved') check(main.includes('ed-review-note'), 'Missing review notice');
      if (a.relationshipSafety) check(main.includes('ed-safety'), 'Missing relationship safety boundary');
      for (const src of ['/assets/mft-booking-core.js', '/assets/mft-booking-config.js', '/assets/mft-booking.js', config.loaderUrl]) check(html.split('src="' + src + '"').length === 2, 'Missing/duplicated booking loader ' + src);
      check(/data-spwidget-scope-global/.test(main), 'Missing general booking binding');
      const cards = main.match(/<div class="ed-clinician-grid">[\s\S]*?<\/div>/)?.[0] || '';
      for (const c of ctx.people.values()) check(cards.includes('href="/' + c.slug + '/"') === a.clinicianLinks.some(link => link.slug === c.slug), 'Wrong clinician connection ' + c.slug);
      const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] || '{}');
      check(schema['@graph']?.length === 2, 'Unexpected editorial schema');
      check(!/"(?:reviewedBy|author|reviewRating|aggregateRating)"/.test(JSON.stringify(schema)), 'Unsupported attribution in schema');
    }
    if (ctx.production) {
      for (const slug of ['resources', 'therapy-approaches', 'marriagereset', ...ctx.people.keys()]) {
        const html = fs.readFileSync(path.join(dist, slug, 'index.html'), 'utf8');
        const block = html.match(/<!--mft-editorial-discovery:start-->[\s\S]*?<!--mft-editorial-discovery:end-->/)?.[0] || '';
        for (const a of ctx.articles.values()) if (a.status !== 'approved' && block.includes('href="/' + a.slug + '/"')) errors.push('Draft leaked into production editorial discovery: ' + a.slug);
      }
    }
  } catch (error) { errors.push('Editorial validation: ' + error.message); }
  return errors;
}
module.exports = { validateEditorial };
