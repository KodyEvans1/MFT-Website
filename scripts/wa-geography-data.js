'use strict';
const { assertSlug, STATUSES } = require('../src/seo-safety');
const GROUPS = { incorporatedPlaces: 'incorporated-place', censusDesignatedPlaces: 'census-designated-place' };
const SOURCE_FIELDS = ['kind', 'name', 'censusName', 'geoid', 'state', 'placeType', 'latitude', 'longitude', 'source'];
function slugify(s) { return s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function text(s) {
  return s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);|&#x([0-9a-f]+);/gi, (_, dec, hex) => String.fromCodePoint(parseInt(dec || hex, dec ? 10 : 16)))
    .replace(/\s+/g, ' ').trim();
}
function validatePlace(e, kind) {
  if (!e || e.kind !== kind || !/^53\d{5}$/.test(e.geoid || '') || e.state !== 'WA')
    throw new Error(`Invalid Washington geography identity: ${e?.geoid}`);
  if (!e.name || !e.censusName || !e.source || !['city', 'town', 'CDP'].includes(e.placeType))
    throw new Error(`Missing source fields: ${e.geoid}`);
  if (!Number.isFinite(e.latitude) || Math.abs(e.latitude) > 90 ||
      !Number.isFinite(e.longitude) || Math.abs(e.longitude) > 180)
    throw new Error(`Invalid coordinates: ${e.geoid}`);
}
// Read named Census columns; city and CDP tables have different column orders.
function parseRows(html, kind) {
  if (!Object.values(GROUPS).includes(kind)) throw new Error(`Unsupported place kind: ${kind}`);
  const clean = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const rows = [...clean.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map(m => [...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c => text(c[1])));
  const head = rows.findIndex(cells => cells.includes('MTFCC') && cells.includes('GEOID'));
  if (head < 0) throw new Error('Census table header not found');
  const headers = rows[head];
  const required = ['MTFCC', 'GEOID', 'STATE', 'BASENAME', 'NAME', 'CENTLAT', 'CENTLON'];
  for (const key of required)
    if (headers.filter(h => h === key).length !== 1) throw new Error(`Missing or duplicate Census column: ${key}`);
  const out = [], ids = new Set();
  for (const cells of rows.slice(head + 1)) {
    if (!cells.length || cells.includes('MTFCC')) continue;
    if (cells.length !== headers.length) throw new Error('Malformed Census data row; refusing partial import');
    const get = key => cells[headers.indexOf(key)];
    const coordinate = key => {
      const value = get(key);
      if (!/^[+-]?\d+(?:\.\d+)?$/.test(value)) throw new Error(`Invalid Census ${key}: ${get('GEOID')}`);
      return Number(value);
    };
    const expectedType = kind === 'incorporated-place' ? 'G4110' : 'G4210';
    if (get('MTFCC') !== expectedType || get('STATE') !== '53') throw new Error('Unexpected Census geography type/state');
    const e = {
      kind, name: get('BASENAME'), censusName: get('NAME'), geoid: get('GEOID'),
      state: 'WA', placeType: (get('NAME').match(/\b(city|town|CDP)$/) || [])[1],
      latitude: coordinate('CENTLAT'), longitude: coordinate('CENTLON'),
      source: kind === 'incorporated-place' ? 'U.S. Census TIGERweb ACS26 incorporated places' : 'U.S. Census TIGERweb ACS26 census-designated places'
    };
    validatePlace(e, kind);
    if (ids.has(e.geoid)) throw new Error(`Duplicate source GEOID: ${e.geoid}`);
    ids.add(e.geoid); out.push(e);
  }
  if (!out.length) throw new Error(`Empty Census import: ${kind}`);
  return out;
}
function mergeGeography(previous, incoming) {
  if (!previous || !Array.isArray(previous.counties)) throw new Error('Missing baseline counties');
  const oldById = new Map(), sourceById = new Map(), usedSlugs = new Set();
  const reserve = slug => {
    assertSlug(slug);
    if (usedSlugs.has(slug)) throw new Error(`Duplicate baseline route: ${slug}`);
    usedSlugs.add(slug);
  };
  for (const county of previous.counties) reserve(county.slug);
  for (const [group, kind] of Object.entries(GROUPS)) {
    if (!Array.isArray(previous[group]) || !Array.isArray(incoming[group]) || !incoming[group].length)
      throw new Error(`Missing/empty geography group: ${group}`);
    for (const old of previous[group]) {
      validatePlace(old, kind); reserve(old.slug);
      if (!STATUSES.has(old.status)) throw new Error(`Invalid retained status: ${old.geoid}`);
      if (oldById.has(old.geoid)) throw new Error(`Duplicate baseline GEOID: ${old.geoid}`);
      oldById.set(old.geoid, old);
    }
    for (const e of incoming[group]) {
      validatePlace(e, kind);
      if (sourceById.has(e.geoid)) throw new Error(`Duplicate source GEOID: ${e.geoid}`);
      sourceById.set(e.geoid, e);
    }
  }
  const missing = [...oldById.keys()].filter(id => !sourceById.has(id));
  if (missing.length) throw new Error(`Refresh would remove ${missing.length} existing geographies; review required: ${missing.slice(0, 12).join(', ')}`);
  for (const [id, old] of oldById)
    if (old.kind !== sourceById.get(id).kind) throw new Error(`Geography kind changed; review required: ${id}`);
  const merged = new Map();
  // Allocate new routes deterministically after reserving every existing route.
  const sorted = [...sourceById.values()].sort((a, b) => a.geoid.localeCompare(b.geoid));
  for (const source of sorted) {
    const old = oldById.get(source.geoid);
    const fields = Object.fromEntries(SOURCE_FIELDS.map(key => [key, source[key]]));
    if (old) {
      // Arbitrary authored content, approvals, slugs, tags and relationships survive.
      merged.set(source.geoid, { ...old, ...fields });
    } else {
      const base = `online-therapy-${slugify(source.name)}-wa`;
      const suffix = source.kind === 'census-designated-place' ? 'cdp' : 'place';
      const choices = [base, base.replace(/-wa$/, `-${suffix}-wa`), base.replace(/-wa$/, `-${source.geoid}-wa`)];
      const slug = choices.find(s => !usedSlugs.has(s));
      if (!slug) throw new Error(`Cannot allocate geography route: ${source.geoid}`);
      reserve(slug);
      merged.set(source.geoid, { ...fields, slug, status: 'draft', tags: ['washington', source.kind, 'telehealth'] });
    }
  }
  const next = { ...previous };
  for (const [group] of Object.entries(GROUPS)) {
    // Existing order stays stable; newly added rows are appended in GEOID order.
    const priorIds = previous[group].map(e => e.geoid);
    const priorSet = new Set(priorIds);
    const addedIds = incoming[group].map(e => e.geoid).filter(id => !priorSet.has(id)).sort();
    next[group] = [...priorIds, ...addedIds].map(id => merged.get(id));
  }
  return next;
}
module.exports = { GROUPS, SOURCE_FIELDS, parseRows, mergeGeography, validatePlace };
