# Washington hierarchy: review implementation

The existing state directory now connects to eight draft editorial browsing regions, all 39 counties and all 639 registered incorporated/Census-designated places. This is a graph: multi-county communities keep every county parent and corresponding breadcrumb path. Region definitions are editorial navigation groups, not official government regions or clinic service boundaries.

## Provenance and refresh

`content/wa-county-crosswalk.json` is a reviewed-source snapshot derived by positive-area intersection of ACS2026 Census polygons, not nearest-centroid guesses. Its source date is January 1, 2026. The source archive contains 281 incorporated places, 358 CDPs and 39 counties. Geometry hashes and the ten audited ring self-touch normalizations are recorded. Tiny ambiguous intersections block graph use. Coordinate-space area ratios are numerical QA only, not land-area statistics. No ambiguous assignments occurred in the initial reviewed snapshot.

Run `python -m unittest discover -s tests/geo -v` and `python scripts/geo/county_crosswalk.py` in the separate source-verification environment with Shapely 2.1.2. The command writes a proposed snapshot in `tmp`, never the editorial geography registry. `--offline` replays archived source responses. Normal website builds use checked-in JSON and do not fetch boundaries or require Python. Compare proposed county/place rows before replacing the snapshot; source-vintage, identity or membership changes require review.

## Rendering and preservation

`geography-graph.js` validates identities, complete region membership, duplicate routes and all place parents. `geography-render.js` provides reciprocal directories, multiple breadcrumb paths, nearby links and explicit source/no-office context. Duplicate names are county-qualified in metadata while existing URL slugs remain stable.

The expansion stage preflights all collisions before deliberately augmenting the existing core geography pages and state hub. It captures the original template first, preserves core story content, then records protected fingerprints. Subsequent expansion must not overwrite those protected pages. Geography validation checks files, required graph links and breadcrumb structure. Existing booking decoration, publication controls and the 0.78 similarity guard remain in force.

## Editorial state and release limits

Six tailored content drafts cover Woodinville, Bothell, Auburn, Coulee Dam, Woodland and Spokane. They appear only in the review build; production rendering excludes them. This initial batch intentionally only accepts draft editorial records. A later reviewed/approved content workflow must add an explicit approval record, not merely remove this guard.

All eight new region pages are drafts. Production navigation omits unapproved regional/community links; existing core content is retained. The directory snapshot is not a claim that every neighborhood or postal address is covered. Straight-line nearby distances are not drive times. Location coverage does not promise clinical availability, insurance eligibility or another physical office.

`npm run check` validates all HTML, links, metadata, booking and geography output. `npm run verify:publication` rehearses preview, accidental indexing-flag preview and isolated production policy. Browser review uses pinned agent-browser against build output at desktop/mobile sizes, with no appointments submitted. Hosted SimplePractice/CSP interaction and the pre-existing main-branch merge conflict are separate release gates. No approved/indexable expansion count is claimed from generated drafts.
