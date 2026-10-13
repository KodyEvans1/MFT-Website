'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { SITE, fileForUrl, writePublication, validatePublication } = require('../src/seo-safety');
const { mergeGeography, parseRows, validatePlace } = require('../scripts/wa-geography-data');

test('existing slashless core URLs retain their canonical spelling', t => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mft-compat-'));
  t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  const file = path.join(d, 'about/index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `<link rel="canonical" href="${SITE}/about"><meta name="robots" content="index,follow">`);
  assert.equal(fileForUrl(d, SITE + '/about'), file);
  assert.equal(fileForUrl(d, SITE + '/about/'), file);
  const env = { SITE_INDEXING_ENABLED: 'true', CONTEXT: 'production' };
  const manifest = writePublication(d, [SITE + '/about'], [], [], env);
  assert.deepEqual(manifest.expectedSitemapUrls, [SITE + '/about']);
  assert.deepEqual(validatePublication(d, [], [], env), []);
});
test('supporting slashless routes does not permit external hosts, credentials or nested paths', () => {
  for (const url of ['https://evil.example/about', 'https://u:p@www.mft.care/about', SITE + '/about?x=1', SITE + '/about#x', SITE + '/a/b'])
    assert.throws(() => fileForUrl('/tmp', url));
});
function place(id, name, kind, type) {
  return { geoid: id, name, censusName: name + ' ' + type, kind, placeType: type,
    state: 'WA', latitude: 47, longitude: -122, source: 'fixture',
    slug: 'place-' + id, status: 'draft', tags: ['original'] };
}
test('legacy City casing is repaired as source data without resetting editorial approval', () => {
  const city = place('5305560', 'Benton City', 'incorporated-place', 'City');
  Object.assign(city, { censusName: 'Benton City city', status: 'approved', editorial: { intro: 'Keep this' } });
  const cdp = place('5300135', 'Aberdeen Gardens', 'census-designated-place', 'CDP');
  const old = { counties: [], incorporatedPlaces: [city], censusDesignatedPlaces: [cdp] };
  const incoming = { incorporatedPlaces: [{ ...city, placeType: 'city' }], censusDesignatedPlaces: [cdp] };
  const next = mergeGeography(old, incoming);
  assert.equal(next.incorporatedPlaces[0].placeType, 'city');
  assert.equal(next.incorporatedPlaces[0].status, 'approved');
  assert.equal(next.incorporatedPlaces[0].slug, city.slug);
  assert.deepEqual(next.incorporatedPlaces[0].editorial, city.editorial);
  assert.throws(() => validatePlace({ ...city, placeType: 'unknown' }, city.kind), /Missing source/);
});
test('Census place type comes from the name suffix, not City within the place name', () => {
  const columns = ['MTFCC', 'GEOID', 'STATE', 'BASENAME', 'NAME', 'CENTLAT', 'CENTLON'];
  const values = ['G4110', '5305560', '53', 'Benton City', 'Benton City city', '+46.2623910', '-119.4811901'];
  const html = '<table><tr>' + columns.map(x => `<th>${x}</th>`).join('') + '</tr><tr>' + values.map(x => `<td>${x}</td>`).join('') + '</tr></table>';
  assert.equal(parseRows(html, 'incorporated-place')[0].placeType, 'city');
});
