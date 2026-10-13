# SEO publishing and geography preservation

This change repairs publishing safeguards without approving content, changing DNS,
merging the review branch, or changing live environment settings.

## Run

- `npm run check`: full site build, output validation and safety regression tests.
- `npm run test:safety`: offline regression tests only.
- `npm run verify:publication`: full builds in temporary directories for disabled
  previews, accidentally enabled previews and an explicitly enabled production-policy
  rehearsal. This command does not deploy or change the source content.
- `npm run geo:verify`: fetch the current Census tables and check a prospective merge;
  never writes the registry.
- `npm run geo:refresh`: perform that validated merge and replace the registry.

## Publication rules

`SITE_INDEXING_ENABLED=true` is necessary for indexable output. Every non-production
Netlify context vetoes it. A Netlify build with missing context and a Preview Server
also remain noindex. An explicit local flag supports offline launch-policy rehearsal.
An approved expansion entity is still noindex in a preview. Draft and reviewed
entities are never indexable. No content is approved by this repair.

The build wrapper passes the effective policy to every existing stage, preserving
core response headers. Both the core sitemap candidates and approved expansion
candidates are retained in `dist/reports/publication.json`. The actual sitemap is
empty while indexing is disabled and otherwise contains exactly the eligible URLs.
Validation checks membership, duplicates, canonical targets, output existence and
noindex exclusions rather than a fixed page count. Validation is part of `npm run
build`, so the existing Netlify build command cannot bypass these gates.

## Route ownership

`content/seo-core-routes.json` explicitly assigns overlapping city and county routes
to the core builder. These pages are not generated again by the expansion engine.
Their before/after SHA-256 hashes are checked. The geography entries still exist
for related-page links and future editorial work. A geography draft that refers to
a core-owned route does not change the core page's existing publication policy.
Any other output collision, duplicate slug, unknown state or unsafe path fails
before expansion writes. Add ownership deliberately; do not use it to conceal
unintended duplicate pages.

## Geography refresh

Source identity is the seven-digit Washington place GEOID. The importer reads
Census columns by name, including CENTLAT/CENTLON, rather than positional offsets.
It only updates documented source fields. Existing slugs, statuses, tags, approval
history, authored content and arbitrary relationship metadata remain unchanged.
New geographies start as drafts. Existing ordering is retained; additions are
ordered deterministically. Missing entities, identity changes, empty groups, invalid
coordinates and duplicate identities/routes stop the refresh instead of deleting
or silently resetting reviewed work. A guarded temporary-file replacement checks
for concurrent edits before replacing the registry.

## Scope not completed here

The geographic county/region hierarchy still needs sourced relationship data.
The current content similarity metric and generic draft copy still need editorial
work; thresholds are not relaxed. Clinician modality claims and content approvals
remain subject to review. A passing CI build is not proof of production behavior,
real appointment routing, visual approval, or a live-domain cutover.

Reference documentation used for the safeguards:
https://docs.netlify.com/build/configure-builds/environment-variables/
https://tigerweb.geo.census.gov/tigerwebmain/Files/acs26/tigerweb_acs26_incplace_wa.html
https://tigerweb.geo.census.gov/tigerwebmain/Files/acs26/tigerweb_acs26_cdp_wa.html
