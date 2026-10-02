'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const safety = require('../src/seo-safety');
const { parseRows, mergeGeography } = require('../scripts/wa-geography-data');
const { writeIfUnchanged } = require('../scripts/import-wa-geographies');
const PROD = { SITE_INDEXING_ENABLED: 'true', CONTEXT: 'production' };
const PREVIEW = { SITE_INDEXING_ENABLED: 'true', CONTEXT: 'deploy-preview' };
function temp(t) { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mft-seo-')); t.after(() => fs.rmSync(d, { recursive: true, force: true })); return d; }
function write(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); }
function page(dist, slug, noindex = true, body = 'fixture') {
  const url = slug ? safety.pageUrl(slug) : safety.SITE + '/';
  write(path.join(dist, slug, 'index.html'), `<link rel="canonical" href="${url}"><meta name="robots" content="${noindex ? 'noindex,nofollow' : 'index,follow'}"><main>${body}</main>`);
}
function entry(slug, status = 'draft', type = 'location') { return { e: { slug, status }, meta: { type } }; }

for (const [label, env, expected] of [
  ['default closed', {}, false], ['production flag off', { CONTEXT: 'production' }, false],
  ['explicit production', PROD, true], ['deploy preview veto', PREVIEW, false],
  ['branch deploy veto', { ...PROD, CONTEXT: 'branch-deploy' }, false],
  ['local dev veto', { ...PROD, CONTEXT: 'dev' }, false],
  ['unknown context veto', { ...PROD, CONTEXT: 'staging' }, false],
  ['preview server veto', { ...PROD, NETLIFY_PREVIEW_SERVER: 'true' }, false],
  ['Netlify context missing veto', { SITE_INDEXING_ENABLED: 'true', NETLIFY: 'true' }, false],
  ['explicit offline rehearsal', { SITE_INDEXING_ENABLED: 'true' }, true]
]) test(`indexing policy: ${label}`, () => assert.equal(safety.indexingEnabled(env), expected));

test('approval and environment are independent requirements', () => {
  for (const status of ['draft', 'reviewed', 'existing']) {
    assert.match(safety.robotsFor(status, PROD), /^noindex/);
    assert.match(safety.robotsFor(status, PREVIEW), /^noindex/);
  }
  assert.match(safety.robotsFor('approved', PREVIEW), /^noindex/);
  assert.match(safety.robotsFor('approved', PROD), /^index,/);
  assert.throws(() => safety.robotsFor('published', PROD), /Unknown/);
});
test('allowlisted core page is preserved byte-for-byte', t => {
  const d = temp(t); page(d, 'spokane', false, 'curated content');
  const before = fs.readFileSync(path.join(d, 'spokane/index.html'));
  const p = safety.planRoutes([entry('spokane'), entry('new-city')], d, ['spokane']);
  assert.deepEqual(p.generate.map(x => x.e.slug), ['new-city']);
  assert.equal(p.preserved.length, 1);
  assert.equal(p.preserved[0].registryStatus, 'draft');
  assert.deepEqual(fs.readFileSync(path.join(d, 'spokane/index.html')), before);
});
test('unknown output collisions fail before any output writes', t => {
  const d = temp(t); page(d, 'spokane');
  assert.throws(() => safety.planRoutes([entry('new-city'), entry('spokane')], d, []), /collision/);
  assert.equal(fs.existsSync(path.join(d, 'new-city')), false);
});
test('duplicate registry slugs fail including retained routes', t => {
  const d = temp(t); page(d, 'spokane');
  assert.throws(() => safety.planRoutes([entry('spokane'), entry('spokane')], d, ['spokane']), /Duplicate/);
});
test('path traversal and unknown status fail', t => {
  const d = temp(t);
  for (const slug of ['../escape', 'foo/bar', '', '%2e%2e', 'foo\\bar'])
    assert.throws(() => safety.planRoutes([entry(slug)], d, []), /Invalid/);
  assert.throws(() => safety.planRoutes([entry('normal', 'published')], d, []), /Unknown/);
});
test('missing owned/existing routes and wrong-family claims fail', t => {
  const d = temp(t);
  assert.throws(() => safety.planRoutes([entry('city')], d, ['city']), /missing/);
  assert.throws(() => safety.planRoutes([entry('city', 'existing')], d, []), /no core owner/);
  page(d, 'city');
  assert.throws(() => safety.planRoutes([entry('city', 'draft', 'modality')], d, ['city']), /Non-location/);
});
test('sitemap grows by expected membership, not a fixed count', () => {
  const core = [safety.SITE + '/'];
  const generated = [{ slug: 'approved-guide', status: 'approved' }, { slug: 'draft-guide', status: 'draft' }];
  assert.equal(safety.expectedSitemap(core, generated, PROD).length, 2);
  assert.deepEqual(safety.expectedSitemap(core, generated, PREVIEW), []);
  assert.throws(() => safety.expectedSitemap([safety.pageUrl('approved-guide')], generated, PROD), /Duplicate/);
});
function publicationFixture(t, env = PROD) {
  const d = temp(t), preview = !safety.indexingEnabled(env);
  page(d, '', preview); page(d, 'approved-guide', preview); page(d, 'draft-guide'); page(d, 'owned-city', preview);
  write(path.join(d, '_headers'), '/*\n  X-Robots-Tag: noindex, nofollow\n');
  const entities = [entry('approved-guide', 'approved'), entry('draft-guide'), entry('owned-city')];
  const plan = safety.planRoutes([entities[2]], d, ['owned-city']);
  const generated = entities.slice(0, 2).map(x => x.e);
  safety.writePublication(d, [safety.SITE + '/', safety.pageUrl('owned-city')], generated, plan.preserved, env);
  return { d, entities: entities.map(x => x.e), owned: ['owned-city'] };
}
test('production publication accepts approved output and preserved core draft aliases', t => {
  const f = publicationFixture(t);
  assert.deepEqual(safety.validatePublication(f.d, f.entities, f.owned, PROD), []);
  assert.equal(safety.sitemapUrls(fs.readFileSync(path.join(f.d, 'sitemap.xml'), 'utf8')).length, 3);
});
test('preview publication has empty sitemap with approved content still noindex', t => {
  const f = publicationFixture(t, PREVIEW);
  assert.deepEqual(safety.validatePublication(f.d, f.entities, f.owned, PREVIEW), []);
  assert.deepEqual(safety.sitemapUrls(fs.readFileSync(path.join(f.d, 'sitemap.xml'), 'utf8')), []);
});
test('missing approved sitemap entry is an error, not a warning', t => {
  const f = publicationFixture(t), file = path.join(f.d, 'sitemap.xml');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/  <url><loc>[^<]*approved-guide[^<]*<\/loc><\/url>\n/, ''));
  assert.match(safety.validatePublication(f.d, f.entities, f.owned, PROD).join('\n'), /missing expected/);
});
test('draft injection into sitemap and canonical mismatch are errors', t => {
  const f = publicationFixture(t), file = path.join(f.d, 'sitemap.xml');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('</urlset>', `<url><loc>${safety.pageUrl('draft-guide')}</loc></url></urlset>`));
  const errs = safety.validatePublication(f.d, f.entities, f.owned, PROD).join('\n');
  assert.match(errs, /unexpected URL/); assert.match(errs, /noindex page/);
  const guide = path.join(f.d, 'approved-guide/index.html');
  fs.writeFileSync(guide, fs.readFileSync(guide, 'utf8').replace('approved-guide/', 'wrong-guide/'));
  assert.match(safety.validatePublication(f.d, f.entities, f.owned, PROD).join('\n'), /canonical mismatch/);
});
test('preserved-page changes are detected by checksum', t => {
  const f = publicationFixture(t); fs.appendFileSync(path.join(f.d, 'owned-city/index.html'), 'oops');
  assert.match(safety.validatePublication(f.d, f.entities, f.owned, PROD).join('\n'), /Core page changed/);
});
test('indexable draft and missing preview response guard fail', t => {
  const f = publicationFixture(t, PREVIEW); page(f.d, 'draft-guide', false);
  write(path.join(f.d, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n');
  const errors = safety.validatePublication(f.d, f.entities, f.owned, PREVIEW).join('\n');
  assert.match(errors, /Wrong robots/); assert.match(errors, /response headers/);
});
test('malformed and external sitemap URLs fail', () => {
  assert.throws(() => safety.sitemapUrls(''), /Invalid/);
  assert.throws(() => safety.sitemapUrls('<urlset><loc>x</loc><loc>x</loc></urlset>'), /duplicate/);
  for (const url of ['https://evil.example/', safety.SITE + '/foo/?x=1', safety.SITE + '/foo/bar/'])
    assert.throws(() => safety.fileForUrl('/tmp', url));
});

function place(geoid, name, kind = 'incorporated-place') {
  return { kind, name, censusName: name + (kind === 'incorporated-place' ? ' city' : ' CDP'), geoid,
    state: 'WA', placeType: kind === 'incorporated-place' ? 'city' : 'CDP', latitude: 47, longitude: -122, source: 'test fixture',
    slug: `online-therapy-${name.toLowerCase().replace(/ /g, '-')}-wa`, status: 'draft', tags: ['washington', kind] };
}
function data() { return { version: 1, counties: [{ slug: 'test-county' }],
  incorporatedPlaces: [place('5300100', 'Aberdeen')], censusDesignatedPlaces: [place('5300135', 'Aberdeen Gardens', 'census-designated-place')] }; }
function incoming(previous) { return structuredClone({ incorporatedPlaces: previous.incorporatedPlaces, censusDesignatedPlaces: previous.censusDesignatedPlaces }); }
test('refresh preserves arbitrary editorial state, approved slug, tags and multiple county links', () => {
  const old = data(); Object.assign(old.incorporatedPlaces[0], { status: 'approved', slug: 'custom-aberdeen',
    title: 'Editorial title', content: { intro: 'Reviewed copy' }, approvalHistory: [{ actor: 'editor' }],
    countyGeoids: ['test-a', 'test-b'], tags: ['custom'], region: { source: 'manual review' } });
  const snapshot = JSON.stringify(old), fresh = incoming(old);
  Object.assign(fresh.incorporatedPlaces[0], { latitude: 47.1, name: 'New Census name', status: 'draft', title: 'IGNORE', slug: 'IGNORE' });
  const next = mergeGeography(old, fresh), got = next.incorporatedPlaces[0];
  assert.equal(got.latitude, 47.1); assert.equal(got.name, 'New Census name');
  for (const key of ['status', 'slug', 'title', 'content', 'approvalHistory', 'countyGeoids', 'tags', 'region'])
    assert.deepEqual(got[key], old.incorporatedPlaces[0][key]);
  assert.equal(JSON.stringify(old), snapshot);
});
test('refresh is idempotent and new records start as drafts', () => {
  const old = data(), fresh = incoming(old); fresh.incorporatedPlaces.push({ ...place('5300905', 'Airway Heights'), status: 'approved' });
  const next = mergeGeography(old, fresh);
  assert.equal(next.incorporatedPlaces[1].status, 'draft');
  assert.deepEqual(mergeGeography(next, fresh), next);
});
test('empty, removed and invalid imported rows cannot erase the registry', () => {
  const old = data(), empty = incoming(old); empty.incorporatedPlaces = [];
  assert.throws(() => mergeGeography(old, empty), /empty/);
  const removed = incoming(old); removed.incorporatedPlaces = [place('5300905', 'Airway Heights')];
  assert.throws(() => mergeGeography(old, removed), /remove/);
  const bad = incoming(old); bad.incorporatedPlaces[0].latitude = NaN;
  assert.throws(() => mergeGeography(old, bad), /coordinates/);
});
test('duplicate IDs and duplicate editorial routes fail without guessing', () => {
  const old = data(), fresh = incoming(old); fresh.incorporatedPlaces.push({ ...fresh.incorporatedPlaces[0] });
  assert.throws(() => mergeGeography(old, fresh), /Duplicate source/);
  const duplicate = data(); duplicate.censusDesignatedPlaces[0].slug = duplicate.incorporatedPlaces[0].slug;
  assert.throws(() => mergeGeography(duplicate, incoming(duplicate)), /Duplicate baseline route/);
});
test('geography kind changes require explicit review', () => {
  const old = data(), fresh = incoming(old);
  fresh.incorporatedPlaces = [place('5300905', 'Airway Heights')];
  fresh.censusDesignatedPlaces.push(place('5300100', 'Aberdeen', 'census-designated-place'));
  assert.throws(() => mergeGeography(old, fresh), /kind changed/);
});
test('same-name new records allocate stable distinct slugs without changing existing routes', () => {
  const old = data(), fresh = incoming(old);
  fresh.incorporatedPlaces.push(place('5300905', 'Same Name'), place('5301010', 'Same Name'));
  fresh.censusDesignatedPlaces.push(place('5300275', 'Same Name', 'census-designated-place'));
  const a = mergeGeography(old, fresh);
  fresh.incorporatedPlaces.reverse(); fresh.censusDesignatedPlaces.reverse();
  assert.deepEqual(mergeGeography(old, fresh), a);
  const slugs = [...a.incorporatedPlaces, ...a.censusDesignatedPlaces].map(e => e.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  assert.equal(a.incorporatedPlaces[0].slug, old.incorporatedPlaces[0].slug);
});
function censusTable(kind, reverse = false, override = {}) {
  const values = { MTFCC: kind === 'incorporated-place' ? 'G4110' : 'G4210', GEOID: '5300100', STATE: '53',
    BASENAME: 'Example', NAME: kind === 'incorporated-place' ? 'Example city' : 'Example CDP', CENTLAT: '+47.12', CENTLON: '-122.34', DISP_CLR: '1.0', ...override };
  const keys = Object.keys(values); if (reverse) keys.reverse();
  return '<table><tr>' + keys.map(k => `<th>${k}</th>`).join('') + '</tr><tr>' + keys.map(k => `<td>${values[k]}</td>`).join('') + '</tr></table>';
}
test('Census coordinate parsing follows named columns in either table order', () => {
  for (const kind of ['incorporated-place', 'census-designated-place']) for (const reverse of [false, true]) {
    const [e] = parseRows(censusTable(kind, reverse), kind);
    assert.equal(e.latitude, 47.12); assert.equal(e.longitude, -122.34);
  }
});
test('Census parsing rejects header drift, empty coordinates, partial rows and wrong state', () => {
  assert.throws(() => parseRows('<html>Unavailable</html>', 'incorporated-place'), /header/);
  assert.throws(() => parseRows(censusTable('incorporated-place').replace('CENTLAT', 'LATITUDE'), 'incorporated-place'), /column/);
  assert.throws(() => parseRows(censusTable('incorporated-place', false, { CENTLAT: '' }), 'incorporated-place'), /Invalid/);
  assert.throws(() => parseRows(censusTable('incorporated-place').replace('<td>1.0</td>', ''), 'incorporated-place'), /Malformed/);
  assert.throws(() => parseRows(censusTable('incorporated-place', false, { STATE: '41' }), 'incorporated-place'), /state/);
});
test('safe file replacement refuses concurrent edits and cleans temporary files', t => {
  const d = temp(t), file = path.join(d, 'geography.json'); write(file, 'original');
  writeIfUnchanged(file, 'original', { test: true });
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { test: true });
  assert.throws(() => writeIfUnchanged(file, 'original', { test: false }), /changed/);
  assert.deepEqual(fs.readdirSync(d), ['geography.json']);
});
test('build wrapper passes the preview veto to every stage', t => {
  const d = temp(t), root = path.resolve(__dirname, '..');
  write(path.join(d, 'scripts/build-site.js'), fs.readFileSync(path.join(root, 'scripts/build-site.js')));
  write(path.join(d, 'src/seo-safety.js'), fs.readFileSync(path.join(root, 'src/seo-safety.js')));
  const stages = ['src/build.js', 'src/enhance.js', 'src/redesign.js', 'scripts/prepare-booking.js', 'src/seo-expansion.js', 'src/validate.js', 'scripts/validate-booking.js'];
  for (const script of stages)
    write(path.join(d, script), `require('node:fs').appendFileSync('stages.txt', '${script}:' + process.env.SITE_INDEXING_ENABLED + '\\n');`);
  const result = spawnSync(process.execPath, ['scripts/build-site.js'], { cwd: d, env: { ...process.env, ...PREVIEW }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const observed = fs.readFileSync(path.join(d, 'stages.txt'), 'utf8').trim().split('\n');
  assert.equal(observed.length, stages.length);
  assert.deepEqual(observed, stages.map(script => script + ':false'));
});
