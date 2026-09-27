# M.F.T. Netlify Launch Gap Report

Prepared September 26, 2026. This report identifies what is built, what remains
unverified, and what must be repaired or approved before `mft.care` is pointed to
the new site.

## Current build

The repository generates 63 content pages and a custom 404 page. Sixty-one
content pages are included in the production sitemap. Two pages remain held out
of indexing: the Couples Retreat page and the legacy Oak Harbor page at
`/new-page-4`.

The production-intended architecture includes:

- 11 core, navigation, statewide, and directory pages
- 8 service and program pages
- 5 clinician profiles
- 13 city, county, and legacy-location pages
- 10 concern guides
- 12 therapy-approach guides
- 4 practical resources

Every content page includes a unique title, description, H1, canonical, Open
Graph metadata, breadcrumb navigation, crawlable internal links, and JSON-LD.
The build also includes `sitemap.xml`, `robots.txt`, `llms.txt`, a page inventory,
security headers, redirect review files, a mobile navigation system, and a
staging-safe noindex default.

## Launch blockers

### Repository access

The connected GitHub repository was not available in the agent workspace and no
GitHub credential or repository tool was exposed. The build is complete locally,
but it has not been pushed into the repository named “MFT website.” Provide the
repository URL or mount the repository before treating GitHub deployment as done.

### Image ownership and hosting

The build references five clinician portraits and two office images using the
current Squarespace CDN URLs. These URLs were observed on the public M.F.T. site,
but the original image files could not be downloaded through the agent network.
Before Squarespace is disabled:

- obtain the approved original logo, favicon, clinician portraits, and office images;
- confirm M.F.T. has permission to reuse every image;
- optimize and store final copies in this repository or another approved asset host;
- confirm crops, alt text, orientation, and mobile rendering;
- replace the current remote Squarespace URLs.

The current build uses a text wordmark because the approved heart logo file was
not available. It also uses conservative system fonts because the exact licensed
brand font files were not available.

### Clinical and professional review

Every clinician must confirm their name, credential display, state credentials,
populations served, focus areas, approaches, availability, and photograph.
Clinicians must also review the concern and therapy-approach guides that describe
their work. The site deliberately avoids assigning every approach to every
clinician.

### Appointment and insurance workflows

The site keeps appointment and insurance actions outside the public site at
`https://ops.mft.care/` and keeps existing-client access in SimplePractice. The
agent network could not exercise the operations portal. Test all three workflows
in a normal browser using non-clinical test data. Confirm whether appointment and
insurance actions need distinct paths rather than the shared operations homepage.

No insurance carrier list is published in the new build. The current public site
shows carrier names, but participation may vary by clinician, service, and plan.
Publish a carrier list only after current operational confirmation. Confirm the
private-pay rule for couples work and any superbill language.

### Location and expansion review

Five demand-supported draft pages are included for Bothell, Kirkland, Redmond,
Bremerton, and Fircrest. Each needs a final usefulness and service review before
launch. They do not claim local offices.

The public legacy page `/new-page-4` is discoverable as an Oak Harbor page and
contains unresolved template placeholders plus unrelated location copy. The new
build replaces that content with a noindex holding page at the same URL. Approve
one of these outcomes before launch: keep and fully rewrite it, redirect it to an
approved Oak Harbor URL, redirect it to the Washington hub, or retire it.

Twenty-one additional cities from the planned expansion remain in
`dist/location-backlog-do-not-publish.json`. They are not generated as landing
pages because the plan requires demand, service fit, unique usefulness, and
review before publication.

### Retreat page

The current public retreat page mixes 2024 and 2026 wording. The new build keeps
the existing `/new-page-2` URL but uses a noindex holding page with no dates,
location, pricing, availability, or outcome claims. Confirm the actual offering
before allowing indexing.

### URLs and redirects

No content redirects are active. Proposed mappings are documented in
`dist/redirects-pending-review.txt`. Search Console URL-level evidence is needed
for `/home-1`, `/new-page`, `/new-page-1`, `/new-page-2`, `/new-page-4`, and
`/new-page-47` before changing these URLs. Preserving current working URLs is the
default.

### Analytics and Search Console

No analytics script was installed because no approved measurement ID, consent
decision, or privacy review was supplied. The build supports a
`GOOGLE_SITE_VERIFICATION` environment value, but the existing Search Console
verification method should be preserved when possible. Do not create a second
property or repeatedly resubmit the sitemap without a reason.

Search Console supplied aggregate performance and coverage totals, but not the
URL lists behind the 24 discovered-not-indexed, two crawled-not-indexed, one
noindex, one 404, and one alternate-canonical states. Export those URL lists for
the final redirect and indexability review.

### Legal, privacy, and accessibility

No public privacy, terms, notice, or accessibility page was discoverable through
the available site search. Confirm which notices must be linked from the footer.
Do not use a generic policy that fails to reflect the actual practice, tracking,
forms, vendors, and state requirements.

Automated structural accessibility checks pass for headings, alternative text,
navigation labels, and keyboard-oriented markup. A human keyboard and screen
reader review is still required.

### Visual and hosted testing

The workspace contained the Playwright library but not a browser binary, and its
download was blocked by network policy. Desktop and mobile screenshots were not
available. Before launch, review the hosted Netlify preview at common desktop,
tablet, and mobile sizes and test:

- header, footer, mobile menu, skip link, focus states, and text wrapping;
- every clinician photo and office image;
- all internal and external links;
- the custom 404 response;
- canonical, robots, sitemap, and response headers;
- page speed and Core Web Vitals under real network conditions.

## Required launch sequence

1. Push this repository to the connected GitHub project and let Netlify build it.
2. Keep `SITE_INDEXING_ENABLED` unset or false during review.
3. Replace the remote image URLs and add the approved logo and favicon.
4. Complete owner, clinician, insurance, location, legal, and workflow reviews.
5. Resolve the two held pages and approve every required redirect.
6. Run hosted desktop, mobile, accessibility, link, schema, and workflow tests.
7. Protect the `ops.mft.care` DNS records and SSL configuration during cutover.
8. Confirm rollback access to the current site.
9. Point the primary domain only after explicit launch approval.
10. Set `SITE_INDEXING_ENABLED=true`, deploy again, and verify the public result.
11. Check the existing Search Console property, sitemap processing, and priority
    URLs after launch. Monitor redirects, 404s, indexing, and external workflows.

## Automated verification completed

The local validation checks one H1 per page, unique titles and descriptions,
unique canonicals, valid JSON-LD, complete internal navigation targets, image alt
attributes, absence of public forms, absence of known stale copy strings, sitemap
coverage, and required Netlify files. The ZIP and repository should be rebuilt
and these checks rerun after any content or URL change.
