'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { parseRows, mergeGeography } = require('./wa-geography-data');
const OUT = path.resolve(__dirname, '../content/wa-geography.json');
const INC = 'https://tigerweb.geo.census.gov/tigerwebmain/Files/acs26/tigerweb_acs26_incplace_wa.html';
const CDP = 'https://tigerweb.geo.census.gov/tigerwebmain/Files/acs26/tigerweb_acs26_cdp_wa.html';
async function get(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'MFT-Website geography refresh' }, signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}
function writeIfUnchanged(file, original, next) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    if (fs.readFileSync(file, 'utf8') !== original) throw new Error('Geography registry changed during refresh; retry after reconciling edits');
    fs.writeFileSync(temporary, JSON.stringify(next, null, 2) + '\n', { flag: 'wx' });
    if (fs.readFileSync(file, 'utf8') !== original) throw new Error('Geography registry changed before replacement');
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}
async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const original = fs.readFileSync(OUT, 'utf8');
  const previous = JSON.parse(original);
  const [inc, cdp] = await Promise.all([get(INC), get(CDP)]);
  const next = mergeGeography(previous, {
    incorporatedPlaces: parseRows(inc, 'incorporated-place'),
    censusDesignatedPlaces: parseRows(cdp, 'census-designated-place')
  });
  next.sourceVintage = '2026';
  if (!dryRun) writeIfUnchanged(OUT, original, next);
  console.log(JSON.stringify({
    mode: dryRun ? 'verification-only' : 'refresh',
    counties: next.counties.length,
    incorporatedPlaces: next.incorporatedPlaces.length,
    censusDesignatedPlaces: next.censusDesignatedPlaces.length,
    total: next.counties.length + next.incorporatedPlaces.length + next.censusDesignatedPlaces.length,
    retainedEditorialRecords: previous.incorporatedPlaces.length + previous.censusDesignatedPlaces.length
  }, null, 2));
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { writeIfUnchanged };
