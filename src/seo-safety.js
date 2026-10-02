'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const SITE = 'https://www.mft.care';
const STATUSES = new Set(['draft', 'reviewed', 'approved', 'existing']);

// An explicit flag is necessary, never sufficient on a preview deployment.
function indexingEnabled(env = process.env) {
  const context = String(env.CONTEXT || '').trim().toLowerCase();
  return /^true$/i.test(env.SITE_INDEXING_ENABLED || '') &&
    (!context || context === 'production') && !env.NETLIFY_PREVIEW_SERVER &&
    !(env.NETLIFY === 'true' && !context);
}
function robotsFor(status, env = process.env) {
  if (!STATUSES.has(status)) throw new Error(`Unknown publication status: ${status}`);
  return status === 'approved' && indexingEnabled(env)
    ? 'index,follow,max-image-preview:large' : 'noindex,nofollow';
}
function assertSlug(slug) {
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw new Error(`Invalid SEO route slug: ${slug}`);
  return slug;
}
function pageUrl(slug) { return `${SITE}/${assertSlug(slug)}/`; }
function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function sitemapUrls(xml) {
  if (!/<urlset\b[^>]*>[\s\S]*<\/urlset>/.test(xml)) throw new Error('Invalid sitemap: missing urlset');
  const urls = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map(m => m[1]);
  if (new Set(urls).size !== urls.length) throw new Error('sitemap: duplicate URLs');
  return urls;
}
function fileForUrl(dist, url) {
  const parsed = new URL(url);
  if (parsed.origin !== SITE || parsed.search || parsed.hash || !parsed.pathname.endsWith('/'))
    throw new Error(`Invalid sitemap URL: ${url}`);
  const slug = parsed.pathname.slice(1, -1);
  if (slug) assertSlug(slug);
  return path.join(dist, slug, 'index.html');
}
function isNoindex(html) { return /<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*\bnoindex\b/i.test(html); }

// The allowlist means "keep the core page", not permission to overwrite it.
function planRoutes(entities, dist, coreOwnedSlugs) {
  const owned = new Set(coreOwnedSlugs.map(assertSlug));
  if (owned.size !== coreOwnedSlugs.length) throw new Error('Duplicate core-owned route');
  const seen = new Set(), generate = [], preserved = [];
  for (const entry of entities) {
    const { e, meta } = entry;
    assertSlug(e.slug);
    if (!STATUSES.has(e.status)) throw new Error(`Unknown publication status for ${e.slug}: ${e.status}`);
    if (seen.has(e.slug)) throw new Error(`Duplicate registry route: ${e.slug}`);
    seen.add(e.slug);
    const file = path.join(dist, e.slug, 'index.html');
    const exists = fs.existsSync(file);
    if (owned.has(e.slug)) {
      if (meta.type !== 'location') throw new Error(`Non-location claims core route: ${e.slug}`);
      if (!exists) throw new Error(`Core-owned page missing: ${e.slug}`);
      preserved.push({ slug: e.slug, owner: 'core', registryStatus: e.status, sha256: sha256(file) });
    } else if (exists) {
      throw new Error(`Unapproved output collision: ${e.slug}; do not overwrite core content`);
    } else if (e.status === 'existing') {
      throw new Error(`Existing entity has no core owner: ${e.slug}`);
    } else generate.push(entry);
  }
  return { generate, preserved };
}
function expectedSitemap(coreUrls, generated, env = process.env) {
  const candidates = [...coreUrls, ...generated.filter(e => e.status === 'approved').map(e => pageUrl(e.slug))];
  if (new Set(candidates).size !== candidates.length) throw new Error('Duplicate publication candidate');
  return indexingEnabled(env) ? candidates.sort() : [];
}
function writePublication(dist, coreUrls, generated, preserved, env = process.env) {
  const expected = expectedSitemap(coreUrls, generated, env);
  for (const url of expected) {
    const file = fileForUrl(dist, url);
    if (!fs.existsSync(file) || isNoindex(fs.readFileSync(file, 'utf8')))
      throw new Error(`Publication candidate missing or noindex: ${url}`);
  }
  const manifest = {
    version: 1,
    indexingEnabled: indexingEnabled(env),
    context: env.CONTEXT || 'local',
    coreSitemapCandidates: coreUrls,
    generatedRoutes: generated.map(e => ({ slug: e.slug, status: e.status })),
    preservedRoutes: preserved,
    expectedSitemapUrls: expected
  };
  fs.mkdirSync(path.join(dist, 'reports'), { recursive: true });
  fs.writeFileSync(path.join(dist, 'reports', 'publication.json'), JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(dist, 'sitemap.xml'),
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    expected.map(url => `  <url><loc>${url}</loc></url>`).join('\n') + '\n</urlset>\n');
  return manifest;
}
function validatePublication(dist, entities, coreOwnedSlugs, env = process.env) {
  const errors = [];
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'reports', 'publication.json'), 'utf8'));
    if (manifest.version !== 1) throw new Error('Unknown publication manifest version');
    if (manifest.indexingEnabled !== indexingEnabled(env)) errors.push('Publication environment differs from build; rebuild first');
    const owned = new Set(coreOwnedSlugs), preserved = new Map();
    for (const item of manifest.preservedRoutes) {
      assertSlug(item.slug);
      if (preserved.has(item.slug) || !owned.has(item.slug)) throw new Error(`Invalid preserved route: ${item.slug}`);
      const file = path.join(dist, item.slug, 'index.html');
      if (!fs.existsSync(file) || sha256(file) !== item.sha256) errors.push(`Core page changed during expansion: ${item.slug}`);
      preserved.set(item.slug, item);
    }
    const generated = new Map(manifest.generatedRoutes.map(e => [e.slug, e.status]));
    if (generated.size !== manifest.generatedRoutes.length) throw new Error('Duplicate generated route in manifest');
    const seen = new Set();
    for (const e of entities) {
      assertSlug(e.slug);
      if (!STATUSES.has(e.status) || seen.has(e.slug)) throw new Error(`Invalid or duplicate registry entity: ${e.slug}`);
      seen.add(e.slug);
      const file = path.join(dist, e.slug, 'index.html');
      if (!fs.existsSync(file)) { errors.push(`Missing registry page: ${e.slug}`); continue; }
      if (preserved.has(e.slug)) {
        if (preserved.get(e.slug).registryStatus !== e.status) errors.push(`Stale preserved status: ${e.slug}`);
        continue;
      }
      if (owned.has(e.slug)) errors.push(`Core route not preserved: ${e.slug}`);
      if (generated.get(e.slug) !== e.status) errors.push(`Registry/manifest mismatch: ${e.slug}`);
      const h = fs.readFileSync(file, 'utf8');
      const shouldIndex = e.status === 'approved' && indexingEnabled(env);
      if (isNoindex(h) === shouldIndex) errors.push(`Wrong robots publication state: ${e.slug}`);
      if (!/<meta\b[^>]*name="robots"/i.test(h)) errors.push(`Missing robots tag: ${e.slug}`);
    }
    for (const slug of [...generated.keys(), ...preserved.keys()])
      if (!seen.has(slug)) errors.push(`Stale manifest route: ${slug}`);
    const expected = expectedSitemap(manifest.coreSitemapCandidates, manifest.generatedRoutes, env);
    if (JSON.stringify(expected) !== JSON.stringify(manifest.expectedSitemapUrls)) errors.push('Stale expected sitemap manifest');
    const actual = sitemapUrls(fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8'));
    const want = new Set(expected), got = new Set(actual);
    for (const url of expected) if (!got.has(url)) errors.push(`sitemap: missing expected URL ${url}`);
    for (const url of actual) {
      if (!want.has(url)) errors.push(`sitemap: unexpected URL ${url}`);
      const file = fileForUrl(dist, url);
      if (!fs.existsSync(file)) { errors.push(`sitemap: missing page ${url}`); continue; }
      const h = fs.readFileSync(file, 'utf8');
      if (isNoindex(h)) errors.push(`sitemap: noindex page ${url}`);
      if (!h.includes(`<link rel="canonical" href="${url}">`)) errors.push(`sitemap: canonical mismatch ${url}`);
    }
    if (!indexingEnabled(env) && !/X-Robots-Tag:\s*noindex/i.test(fs.readFileSync(path.join(dist, '_headers'), 'utf8')))
      errors.push('Preview must retain noindex response headers');
  } catch (error) { errors.push(`Publication validation: ${error.message}`); }
  return errors;
}
module.exports = { SITE, STATUSES, indexingEnabled, robotsFor, assertSlug, pageUrl, sitemapUrls,
  fileForUrl, isNoindex, planRoutes, expectedSitemap, writePublication, validatePublication };
