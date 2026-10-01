# M.F.T. Netlify Launch Gap Report

Updated September 30, 2026. This report identifies what is built, what remains
unverified, and what must be repaired or approved before `mft.care` is pointed to
the new site.

## Current build

The repository generates 69 content and utility pages plus a custom 404 page.
Sixty-three pages are included in the production sitemap. Six pages remain held
out of indexing: the Couples Retreat page, the legacy Oak Harbor page at
`/new-page-4`, the Marriage.Reset submission confirmation page, and three
paid-search landing pages under `/lp/google/`.

The production-intended architecture includes:

- 12 core, navigation, statewide, consultation, and directory pages
- 8 service and program pages
- 5 clinician profiles
- 13 city, county, and legacy-location pages
- 10 concern guides
- 12 therapy-approach guides
- 4 practical resources
- 3 noindex paid-search landing pages

The consultation architecture appears in primary navigation, page heroes,
service pages, concern pages, clinician pages, location pages, resources, and
the footer. It offers a free 10-minute fit and logistics consultation, an
extended 30-minute consultation, and a 53-minute initial diagnostic session as
the standard direct start for individual therapy.

The services hub now compares audiences, service focus, clinicians, and
approaches. The team directory can be filtered by audience and includes Charlene
Brister as Clinical Manager with her current public-site photograph. Generic
repeated sections have been replaced with page-specific decision support.

Every content page includes a unique title, description, H1, canonical, Open
Graph metadata, breadcrumb navigation, crawlable internal links, and JSON-LD.
The build also includes `sitemap.xml`, `robots.txt`, `llms.txt`, a page inventory,
security headers, redirect review files, a mobile navigation system, and a
staging-safe noindex default.

## Launch blockers

### Marriage.Reset assessment access

The build now includes `/marriage-reset-assessment/`, a noindex confirmation page,
and a Netlify access-request form limited to two email addresses. The submitting
partner must confirm permission to provide the other address, and both required
confirmations explain that the assessment is not therapy, diagnosis, crisis support,
or emergency care.

Before accepting real submissions:

- approve the visible program copy and confirm that assessment access is free;
- enable Netlify form detection and test with non-client email addresses;
- decide who may access submissions and receive notifications;
- approve how each partner receives a separate assessment invitation;
- approve a privacy notice and a short retention/deletion schedule;
- confirm the vendor arrangement is appropriate for this use with the practice's
  privacy, compliance, and legal advisors;
- never add names, narratives, assessment responses, clinical information,
  insurance information, or emergency details to this form;
- delete the test request and regularly delete fulfilled production requests.

Netlify states that Forms submissions are stored in its database and recommends
active export/deletion management for PII. The current form should therefore be
treated as a temporary invitation queue, not an intake or assessment record.

### Paid-search attribution and conversion measurement

Three purpose-built Google Ads landing pages are included and intentionally
excluded from navigation, indexing, and the sitemap. Scheduling links pass a
first-party `source=google_ads`, page origin, and intent. Browser code also
preserves `gclid`, `gbraid`, `wbraid`, standard UTM values, and common ValueTrack
parameters when a visitor continues to `ops.mft.care`.

This creates campaign-specific routes and preserves click identifiers, but it
does not by itself prove a conversion. Before spending against these pages:

- provide and approve the Google tag or Google Analytics measurement ID;
- decide which consent and privacy behavior applies;
- configure Google Ads auto-tagging and final URLs for the correct `/lp/google/`
  page;
- make the operations app retain source and click parameters through signup;
- emit a successful self-scheduling event only after booking is completed;
- configure cross-domain measurement between `www.mft.care` and `ops.mft.care`;
- test with a non-client booking and confirm the event in Google Ads or Analytics.

### Image ownership and hosting

The build references six staff portraits and two office images using the
current Squarespace CDN URLs. These URLs were observed on the public M.F.T. site,
but the original image files could not be downloaded through the agent network.
Before Squarespace is disabled:

- obtain the approved original logo, favicon, clinician portraits, and office images;
- confirm M.F.T. has permission to reuse every image;
- optimize and store final copies in this repository or another approved asset host;
- confirm crops, alt text, orientation, and mobile rendering;
- replace the current remote Squarespace URLs.

The current build uses a clean text wordmark because the approved original logo
file was not available. The temporary square mark has been removed rather than
guessing or redrawing the logo. Supply an approved transparent SVG or
high-resolution PNG to replace the wordmark and generate a favicon. The site
uses conservative system fonts because the exact licensed brand font files were
not available.

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
Also confirm the exact scheduling routes and operating rules for the free 10-minute
consultation, the price and availability of the 30-minute consultation, and the
53-minute initial diagnostic session.

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
3. Add the approved logo and favicon; replace remote images with owned copies.
4. Confirm consultation pricing, routes, availability, and operations-app signup.
5. Add approved measurement and consent configuration, then test cross-domain conversions.
6. Complete owner, clinician, insurance, location, legal, and workflow reviews.
7. Resolve the two held pages and approve every required redirect.
8. Run hosted desktop, mobile, accessibility, link, schema, and workflow tests.
9. Protect the `ops.mft.care` DNS records and SSL configuration during cutover.
10. Confirm rollback access to the current site.
11. Point the primary domain only after explicit launch approval.
12. Set `SITE_INDEXING_ENABLED=true`, deploy again, and verify the public result.
13. Check the existing Search Console property, sitemap processing, and priority
    URLs after launch. Monitor redirects, 404s, indexing, and external workflows.

## Automated verification completed

The local validation checks one H1 per page, unique titles and descriptions,
unique canonicals, valid JSON-LD, complete internal navigation targets, image alt
attributes, restriction of the sole public form to the approved two-email access
request, absence of known stale copy strings, sitemap coverage, and required
Netlify files. The ZIP and repository should be rebuilt
and these checks rerun after any content or URL change.
