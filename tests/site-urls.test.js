'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SITE, pagePath, pageUrl, pageLink } = require('../src/site-urls');
const { expectedSitemap, sitemapUrls } = require('../src/seo-safety');
const dist = path.join(__dirname, '../dist');
const htmlFiles = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const file = path.join(dir, entry.name);
  return entry.isDirectory() ? htmlFiles(file) : entry.name === 'index.html' ? [file] : [];
});

test('page addresses share the final directory spelling for home, clinicians and nested pages', () => {
  for (const [slug, expected] of [['', '/'], ['emily-johnsrud-bio', '/emily-johnsrud-bio/'], ['gary-ashley', '/gary-ashley/'], ['marriage-reset-assessment/thanks', '/marriage-reset-assessment/thanks/']]) {
    assert.equal(pagePath(slug), expected);
    assert.equal(pageUrl(slug), SITE + expected);
  }
  for (const invalid of ['../gary-ashley', '/gary-ashley', 'gary-ashley/', 'gary-ashley?x=1', 'gary-ashley#person', 'a//b', 'https://evil.example'])
    assert.throws(() => pagePath(invalid), /Invalid page route/);
});

test('rendered first-party source links normalize without rewriting files, external links or fragments', () => {
  assert.equal(pageLink(SITE + '/emily-johnsrud-bio'), SITE + '/emily-johnsrud-bio/');
  assert.equal(pageLink('/gary-ashley?source=example#contact'), '/gary-ashley/?source=example#contact');
  for (const unchanged of ['#contact', '/assets/portrait.jpg', '/sitemap.xml', 'mailto:support@mft.care', 'https://example.org/gary-ashley', '//example.org/'])
    assert.equal(pageLink(unchanged), unchanged);
});

test('publication cannot advertise both a redirecting URL and its final URL as separate pages', () => {
  const env = { CONTEXT: 'production', SITE_INDEXING_ENABLED: 'true' };
  assert.deepEqual(expectedSitemap([SITE + '/', SITE + '/emily-johnsrud-bio'], [], env), [SITE + '/', SITE + '/emily-johnsrud-bio/']);
  assert.throws(() => expectedSitemap([SITE + '/gary-ashley', SITE + '/gary-ashley/'], [], env), /Duplicate publication/);
});

test('built page canonical, Open Graph and its structured-data identities use the served directory URL', () => {
  for (const file of htmlFiles(dist)) {
    const slug = path.relative(dist, path.dirname(file)).split(path.sep).join('/');
    const expected = pageUrl(slug);
    const html = fs.readFileSync(file, 'utf8');
    assert.equal(html.match(/<link rel="canonical" href="([^"]+)"/)?.[1], expected, slug + ' canonical');
    assert.equal(html.match(/<meta property="og:url" content="([^"]+)"/)?.[1], expected, slug + ' Open Graph');
    const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1]);
    const items = schema['@graph'] || [schema];
    for (const item of items.filter(item => ['WebPage', 'Person'].includes(item['@type']))) {
      assert.equal(item.url, expected, slug + ' ' + item['@type'] + ' url');
      if (item['@id']) assert.equal(new URL(item['@id']).pathname, new URL(expected).pathname, slug + ' identity');
    }
  }
});

test('built internal page links and sitemap entries share the same final URL spelling', () => {
  const pages = htmlFiles(dist);
  const pagePaths = new Set(pages.map(file => pagePath(path.relative(dist, path.dirname(file)).split(path.sep).join('/'))));
  for (const file of pages) {
    const html = fs.readFileSync(file, 'utf8');
    for (const match of html.matchAll(/<a\b[^>]*href="([^"]+)"/g)) {
      const href = match[1].replace(/&amp;/g, '&');
      if (!/^(?:\/(?!\/)|https:\/\/www\.mft\.care(?:\/|$))/.test(href)) continue;
      const url = new URL(href, SITE);
      const finalPath = url.pathname.endsWith('/') ? url.pathname : url.pathname + '/';
      if (pagePaths.has(finalPath)) assert.equal(url.pathname, finalPath, path.relative(dist, file) + ': ' + href);
    }
  }
  for (const url of sitemapUrls(fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8'))) {
    const pathname = new URL(url).pathname;
    assert.ok(pagePaths.has(pathname), 'sitemap final page: ' + url);
    const html = fs.readFileSync(path.join(dist, pathname, 'index.html'), 'utf8');
    assert.equal(html.match(/<link rel="canonical" href="([^"]+)"/)?.[1], url, 'sitemap canonical: ' + url);
  }
});
