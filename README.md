# M.F.T. website

Production-candidate static site for `mft.care`, built for Netlify. The site is
staging-safe by default and does not collect clinical, intake, appointment, or
insurance-member information.

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
- Existing-client access remains in SimplePractice.
- No Webflow, Netlify, or repository form stores sensitive client information.
- Clinician, insurance, approach, and availability claims require final review.
- The couples-retreat page stays noindex until dates, location, offering, and
  availability are confirmed.

## Updating content

Site content lives in `src/build.js`. After edits, run `npm run check` and commit
both source changes and the regenerated `dist` directory.
