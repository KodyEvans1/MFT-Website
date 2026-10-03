"""Build an auditable ACS26 place/county crosswalk. Never edits editorial records.
Run separately from normal site builds. Network responses are archived for replay.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import shapely
from shapely.geometry import shape
from shapely.ops import unary_union

SERVICE = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2026/MapServer'
LAYERS = {'counties': 82, 'incorporatedPlaces': 28, 'censusDesignatedPlaces': 30}
ROOT = Path(__file__).resolve().parents[2]


def read_json(url: str, file: Path, offline: bool) -> tuple[dict, str]:
    if not offline:
        with urlopen(Request(url, headers={'User-Agent': 'MFT-Website geography verification'}), timeout=90) as response:
            raw = response.read(48 * 1024 * 1024 + 1)
        if len(raw) > 48 * 1024 * 1024:
            raise ValueError('Census response exceeded size limit')
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_bytes(raw)
    raw = file.read_bytes()
    data = json.loads(raw)
    if not isinstance(data, dict) or 'error' in data:
        raise ValueError(f'Invalid Census response for {url}')
    return data, hashlib.sha256(raw).hexdigest()


def features(group: str, cache: Path, offline: bool) -> tuple[list[dict], dict]:
    layer = LAYERS[group]
    base = f'{SERVICE}/{layer}'
    meta, meta_hash = read_json(base + '?f=json', cache / f'{group}-metadata.json', offline)
    if '2026' not in meta.get('description', ''):
        raise ValueError(f'Wrong source vintage for {group}')
    query = {'where': "STATE='53'", 'outFields': 'GEOID,STATE,BASENAME,NAME,CENTLAT,CENTLON',
             'returnGeometry': 'true', 'outSR': '4326', 'orderByFields': 'GEOID', 'f': 'geojson'}
    url = base + '/query?' + urlencode(query)
    data, digest = read_json(url, cache / f'{group}.geojson', offline)
    rows = data.get('features')
    if data.get('exceededTransferLimit') or not isinstance(rows, list) or not rows:
        raise ValueError(f'Empty or truncated Census {group}')
    count_url = base + '/query?' + urlencode({'where': "STATE='53'", 'returnCountOnly': 'true', 'f': 'json'})
    count, count_hash = read_json(count_url, cache / f'{group}-count.json', offline)
    if count.get('count') != len(rows):
        raise ValueError(f'Incomplete Census {group}: expected {count.get("count")}, got {len(rows)}')
    ids = [r.get('properties', {}).get('GEOID') for r in rows]
    if len(set(ids)) != len(ids) or any(not isinstance(i, str) or not i.startswith('53') for i in ids):
        raise ValueError(f'Invalid or duplicate Census IDs in {group}')
    rows.sort(key=lambda r: r['properties']['GEOID'])
    return rows, {'layer': layer, 'url': url, 'sha256': digest, 'metadataSha256': meta_hash,
                  'countSha256': count_hash, 'records': len(rows)}


def polygon(feature: dict):
    geometry = shape(feature['geometry'])
    if geometry.is_empty or not geometry.is_valid or geometry.geom_type not in ('Polygon', 'MultiPolygon'):
        raise ValueError(f'Invalid source polygon: {feature.get("properties")}')
    if not math.isfinite(geometry.area) or geometry.area <= 0:
        raise ValueError('Invalid source area')
    return geometry


def memberships(place, counties: list[tuple[str, object]]) -> tuple[list[str], list[str]]:
    """Use positive-area overlap, not centroids or boundary-only touching.
    Ratios are numerical QA in source coordinates, not published land-area measures.
    Very small positive intersections require human review, never silent assignment.
    """
    confirmed, ambiguous, pieces = [], [], []
    for geoid, county in counties:
        if not place.intersects(county):
            continue
        part = place.intersection(county)
        if part.area <= 0:
            continue
        pieces.append(part)
        if part.area / place.area < 1e-7:
            ambiguous.append(geoid)
        else:
            confirmed.append(geoid)
    if not pieces or unary_union(pieces).area / place.area < 0.999999:
        raise ValueError('County geometry does not cover place; refusing guessed membership')
    if not confirmed:
        raise ValueError('No significant county intersection')
    return sorted(confirmed), sorted(ambiguous)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', type=Path, default=ROOT / 'tmp/census-crosswalk-sources')
    parser.add_argument('--output', type=Path, default=ROOT / 'tmp/wa-county-crosswalk.json')
    parser.add_argument('--offline', action='store_true')
    args = parser.parse_args()
    registry = json.loads((ROOT / 'content/wa-geography.json').read_text())
    if str(registry.get('sourceVintage')) != '2026':
        raise ValueError('Registry and crosswalk vintage must match')
    data, sources = {}, {}
    for group in LAYERS:
        data[group], sources[group] = features(group, args.cache, args.offline)
    county_names = {r['properties']['NAME'] for r in data['counties']}
    if county_names != {r['name'] for r in registry['counties']} or len(county_names) != 39:
        raise ValueError('County snapshot does not match registered counties')
    for group in ('incorporatedPlaces', 'censusDesignatedPlaces'):
        got = {r['properties']['GEOID']: r['properties']['BASENAME'] for r in data[group]}
        expected = {r['geoid']: r['name'] for r in registry[group]}
        if got != expected:
            raise ValueError(f'{group} changed; reconcile source refresh before creating hierarchy')
    county_shapes = [(r['properties']['GEOID'], polygon(r)) for r in data['counties']]
    places, review = [], []
    for group in ('incorporatedPlaces', 'censusDesignatedPlaces'):
        for feature in data[group]:
            p = feature['properties']
            confirmed, ambiguous = memberships(polygon(feature), county_shapes)
            places.append([p['GEOID'], confirmed])
            if ambiguous:
                review.append({'geoid': p['GEOID'], 'name': p['NAME'], 'ambiguousCountyGeoids': ambiguous})
    result = {'version': 1, 'sourceVintage': '2026', 'sourceDate': '2026-01-01',
              'method': 'positive-area polygon intersection; boundary-only contacts excluded; tiny overlaps flagged',
              'software': {'shapely': shapely.__version__}, 'sources': sources,
              'counties': [[r['properties']['GEOID'], r['properties']['NAME']] for r in data['counties']],
              'places': sorted(places), 'reviewRequired': review}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    # Deliberately write a proposed snapshot, never content/wa-geography.json.
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'counties': len(county_shapes), 'places': len(places),
                      'multiCountyPlaces': sum(len(r[1]) > 1 for r in places), 'reviewRequired': review}, indent=2))


if __name__ == '__main__':
    main()
