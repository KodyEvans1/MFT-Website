# October 2 Plaud visual audit: first-page corrections

Source: latest available Plaud recording, October 2, 2026, titled
"Marriage and Family Therapy Website Homepage Redesign - UX Fixes, CTA
Clarification, and Navigation Updates." Raw transcript and highlights read.
The summary calls it a homepage; the speaker explicitly reads the breadcrumb
"Home / Resources / How to Start Therapy" at 00:31-01:00. The full redesign
therefore targets `/how-to-start-therapy/`, not an invented new home route.

## Source-to-change map

- 00:31-01:00: remove the visible breadcrumb from the named first page.
- 01:02-01:28: consultation goes to SimplePractice, not the staff dashboard.
  Retain the owner's previously supplied practice-wide widget configuration.
- 01:31-02:27: retain Staff operations only in the footer for ordinary visitors;
  preserve the existing Marriage.Reset top-navigation item and add a distinct
  Marriage.Reset client sign-in on its public page using the known Ops root.
- 02:27-03:24: replace the unbalanced generic section with separate consultation,
  appointment and benefits buttons. Benefits opens an email to support@mft.care.
- 03:24-04:21: use stronger dark-green/old-gold treatment and clear action styling.
- 04:23-05:22: show Clarify, Review clinician information, Schedule; then common
  questions and an email support action. Delete the repeated closing CTA on the
  named page and homepage. Keep the footer content and structure unchanged.
- 05:26-05:49: retain the existing official top logo and exact business name
  Marriage.Family.Therapy without a trailing period. Do not redesign unrelated
  pages before review of this first-page direction.

The note does not specify new fees, service durations beyond the 10-minute
consultation, new clinical policy, or an automatic email-sending integration.
None is introduced. FAQ copy explains actual navigation/destinations and the
existing request-versus-confirmation boundary, rather than inventing clinical
answers. The support buttons open an email client; no message is sent by the site.
No public health/insurance intake fields are added.

## Implementation

`src/start-page.js` makes bounded, idempotent edits after the existing expansion
engine finishes. `src/assets/start-page.css` is scoped to the named guide and small
homepage interaction improvements. The small `src/seo-expansion.js` coordinator
invokes the unchanged engine and then redecorates the three edited pages. Header,
footer, existing-client access, geography, clinician IDs, draft states and
measurement flags are preserved. Generic decision drafts are generated before
this first-page override, so they keep their original template. The engine moved
to `src/seo-expansion-engine.js` without any content changes.

## Verification and limits

`npm run check` includes 12 new regression tests. Run
`node tests/start-page-browser.cjs` with agent-browser to check the 3 affected
routes at 1440, 768, 390 and 320 pixels, section navigation, FAQ mouse/keyboard
interaction, services/team links, and mobile Marriage.Reset navigation.
This does not send an email, sign in to Ops, submit an appointment, verify the
hosted SimplePractice SDK, approve clinical content, or activate measurement.

Production release is not authorized by this edit request. Keep the existing
review branch, draft PR and noindex behavior. The unrelated editorial source-link
browser failure and pre-existing main-branch conflict are separate open items.
