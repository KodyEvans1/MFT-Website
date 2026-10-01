# M.F.T. website

Production-candidate static site for `mft.care`, built for Netlify. The site is
staging-safe by default and does not collect clinical, intake, appointment, or
insurance-member information. The Marriage.Reset access form is deliberately
limited to two email addresses and two required confirmations.

The generated site includes a sitewide consultation pathway (free 10-minute,
30-minute, and 53-minute individual diagnostic options), clinician filtering,
page-specific care decision content, and three noindex paid-search landing pages.
Those landing pages preserve common Google Ads and UTM click parameters when a
visitor continues to `ops.mft.care`.

## Local build

```bash
npm run check
python -m http.server 4173 --directory dist
```

## Netlify

Connect this repository and use the included `netlify.toml`. The build command
is `npm run build`; the publish directory is `dist`.

The build defaults to `noindex,nofollow`. Do not enable production indexing
until every item in `reports/LAUNCH-GAP-REPORT.md` is resolved or explicitly
accepted. At launch, set `SITE_INDEXING_ENABLED=true` in Netlify and run a fresh
deploy. Add `GOOGLE_SITE_VERIFICATION` only if the existing Search Console
verification cannot be preserved through DNS or the current method.

## Content and privacy

- Appointment and insurance workflows remain at `ops.mft.care`.
- The operations app must retain source/click parameters and record the completed
  booking event before Google Ads conversion reporting can be considered complete.
- Add an approved Google measurement ID, consent behavior, and cross-domain setup
  before relying on paid-search conversion data.
- Existing-client access remains in SimplePractice.
- The Marriage.Reset access-request form uses Netlify Forms and asks only for two
  email addresses. It must not be expanded to collect names, relationship details,
  assessment answers, clinical information, insurance information, or emergencies.
- Before accepting production submissions, approve the privacy notice, access roles,
  retention/deletion schedule, email process, consent language, and vendor terms.
- Clinician, insurance, approach, and availability claims require final review.
- The couples-retreat page stays noindex until dates, location, offering, and
  availability are confirmed.
- The three `/lp/google/` routes stay noindex and out of the sitemap. Use them as
  Google Ads final URLs, not as organic location or keyword pages.
- The temporary logo mark was removed. Add the approved original SVG or PNG plus
  a favicon when those assets are available.

## Marriage.Reset access requests

After deployment, open the site in Netlify, go to **Forms**, and enable form
detection. Trigger a new deploy after enabling it. Submit one test using non-client
addresses, confirm that `marriage-reset-access` appears in the Forms dashboard,
confirm the success page loads, then delete the test submission.

Configure form notifications only to an approved M.F.T. account. Establish a short
retention period and delete fulfilled requests regularly. Do not place assessment
answers or relationship details in Netlify Forms or notification emails.

## Updating content

Site content lives in `src/build.js`. After edits, run `npm run check` and commit
both source changes and the regenerated `dist` directory.
