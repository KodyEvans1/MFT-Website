# M.F.T. website marketing implementation — November 18, 2026

## Candidate and release boundary

Implements `MFT_Website_Marketing_Improvements_2026-11-17.md` on exact current
main `ef336ae9d12423273d598e247bdf1adf32e71dca` in
[draft PR #18](https://github.com/KodyEvans1/MFT-Website/pull/18), branch
`review/marketing-improvements-20261118`. This is a review candidate;
it has not been merged or deployed to the public website. No advertising
settings, campaigns, Ops, financial releases, tablet software, client records,
or appointment requests were changed.

Existing work was inspected first: measurement PR #11, Tri-Cities PR #14, and
separate care/teen PR #15 remain independent open work. Selected requirements
were implemented on current main without merging their older branches.
Merged Autumn/Taylor profiles, Autumn booking, Sonia's approved full biography
and canonical redirect, and existing care journeys are preserved.

## Exact page changes

| Preserved route | Candidate behavior |
| --- | --- |
| `/online-therapy-tri-cities-wa/` | Adult-individual telehealth opening from the brief; service-specific primary action; optional consultation; benefits link; Woodinville-only office clarification; qualified Gary/Sonia profile cards; payment, getting-started and FAQ sections; repeated appointment action. Returning-client access is compact and couples care moves to related navigation. |
| `/gary-ashley/` | Gary-specific online request in header, introduction, after the biography and footer, all retaining approved clinician ID `2154633`. Existing biography, age groups, credentials and portrait are unchanged. |
| `/sonia-hassan-bio/` | Same entry points for Sonia, retaining ID `2065412`; owner-approved full biography, teen/adult/older-adult/couples scope, LSWAIC credential and portrait are unchanged. |
| `/new-page/` | Direct individual-evaluation primary action, optional consultation secondary action, qualified coverage copy and repeated action. The existing evaluation card now enters `/request` instead of the bare portal homepage. |
| `/marriage-and-couples-therapy-counseling/` | Couples-consultation primary action, private-pay framing, repeated action and explicit required consultation → one evaluation per partner → first couples-session sequence. Existing safety guidance remains. |

Both footer entry points are covered: the prominent action and the preserved
utility request link use the page-specific destination. Gary and Sonia retain
their clinician in both. The existing-client utility link now opens `/sign-in`
on all five candidate pages and is excluded from new-client measurement.

Links do not invent service or location parameters. Visitors are told to confirm
the clinician, initial evaluation and Telehealth in SimplePractice when offered,
and to contact the practice if the needed option is absent. The website does
not reinterpret a general therapy session as an initial evaluation.

The implementation extends existing shared components and native anchors through
`src/marketing-improvements.js` and `scheduling-actions.forPage`. Structured copy
is in `content/marketing-improvements.json`; styles are scoped to the five pages.
It runs after existing page composition and before protected-route fingerprints,
so generated drafts cannot inherit the new landing-page text.

## Approval process

`content/marketing-improvements-review.json` follows the existing review-record
pattern: clinical, operational and publication decisions each need a named
reviewer, evidence and the exact current content revision. All remain pending.
The review revision is
`65c60c3257652c3db952954908cd2eef562c1f444d5db230c380e14053e1f1d5`.
Pending or stale evidence suppresses these new page changes in production,
including production builds with indexing disabled. The review candidate remains
available in local/preview builds. Neither existing rich-route authorization nor
a passing build is recorded as approval of this new copy.

Individual and Couples still retain the existing clinical publication notice.
No cosmetic removal or fabricated clinical approval was made. The Clinic Manager
must confirm the adult telehealth roster, current services, payer participation
per clinician and the initial-evaluation scheduling option. Profile cards do not
promise openings or plan participation.

## Fresh production baseline and actual booking inspection

At 12:33:39 p.m. PST on November 18 (`2026-11-18T20:33:39Z`), the five requested public HTML routes plus Autumn's
profile byte-matched an isolated production-context build of exact main
`ef336ae9...`. This establishes the starting deployed source independently of
older crawled page text. Production is built with indexing and its existing
basic measurement enabled; tracked default `dist` alone is not that baseline.

Read-only desktop browser inspection explicitly declined website analytics:

- Tri-Cities opens the general clinician search. Its old generic heading and
  couples shortcut strip are still live.
- Gary and Sonia retain the correct clinician in the actual vendor service
  screen. Selecting the listed 53-minute individual service and Telehealth
  reaches a calendar that retains the clinician and Telehealth.
- Both clinician menus show `Individual Therapy Session (53 Minutes)`,
  `Initial 30 Paid Consultation`, and `10 min Complimentary Phone Consultation`.
  No separately named diagnostic evaluation/90791 was visible in those menus
  or the general service filter. The initial-evaluation mapping remains unverified.
- The live Individual evaluation card currently opens the bare portal homepage;
  the candidate fixes this website routing defect.
- Couples' paid consultation opens general clinician search. The required
  couples sequence and private-pay/safety text remain present.
- The free consultation dialog disables Continue until acknowledged. Cancel
  stays on the page and restores focus; acknowledged Continue opens clinician
  search. Paid consultation links do not use that free-introduction dialog.

CI subsequently exercised the built candidate against real SimplePractice:
Chrome passed 14 same-tab handoffs, including all six current clinician
profiles. Gary Ashley, Sonia Hassan and Autumn Alexander were identified in
the rendered service screen, rather than inferred from an HTTP response alone.
WebKit separately passed two general desktop/mobile handoffs to clinician
search; its scope does not include clinician-specific service or calendar
verification. Chrome also reached Kody's optional consultation/Telehealth
calendar and verified a static link with JavaScript disabled.

No slot was selected, no patient data was entered, and no appointment was
submitted. Calendar navigation is not evidence of a confirmed appointment.

## Measurement

See `SCHEDULING-MEASUREMENT-20261118.md` for the exact event contract and minimized
payload. One existing isolated GA4 helper is retained; no duplicate Google tag
or additional collector is installed. Analytics refusal, GPC and DNT cannot
block scheduling. Prior visit-only grants require a fresh v3 choice; prior
refusals remain respected.

`appointment_request_click`, `clinician_schedule_click` and `consultation_click`
describe different actions. `simplepractice_exit` describes an attempted native
handoff; canceling the optional dialog does not send it. These events are not
bookings and must not be summed as acquisitions. A ready helper receives only
allowlisted scalar intent fields synchronously; navigation never waits for it.
Blocked or unloaded analytics can leave measurement unavailable while booking
navigation continues.

Current campaign IDs `24362234053`, `24435101888`, `24444626634`, `24449945489`
and historical `24274542446` are allowed at both existing boundaries. No raw
click identifiers, selected clinicians, clinical information, form values,
unrestricted URLs or patient-linked outcomes are sent. No Ops mapping or
Google Ads conversion setting was modified.

## Test environments and evidence

| Environment | Verified result and limits |
| --- | --- |
| Local source build | `npm run check`: 327 Node tests pass. Six Python regression checks also pass for detached-frame interception, complete request bodies, canceled static assets and failing closed on a rejected or unverifiable measurement payload. |
| Isolated publication builds | Preview default, accidental preview indexing and production policy all pass: 829 HTML pages, 757 generated pages, 11 preserved core pages, and 251 pre-existing draft warnings; zero validator errors. Preview sitemaps contain zero URLs; the production-policy rehearsal contains 63. These are not deployments. |
| Independent output audit | Exactly five review-page bodies change among 829 outputs after normalizing the stylesheet version. Pending approvals suppress new production copy across all 829 outputs. Teen, Autumn and Taylor content remain unchanged. |
| CI candidate UI | 136/136 cases pass: 20 layout, 40 primary/header/repeated/prominent-footer handoffs, 10 returning-client links, 20 utility links, 4 clinician cards, 2 consultation interactions and 40 privacy/script/no-JavaScript resilience cases. All scheduler traffic is mocked in this suite. No script/console errors or attempted writes. |
| CI real scheduler | Chrome 14/14 and WebKit 2/2 same-tab handoffs pass, with the scope described above. No appointment is submitted. Provider telemetry writes are blocked; those are separate from the UI suite's zero attempted writes. |
| CI actual Google library | The original exact one-handoff assertion and keyboard-footer subtype/handoff assertions pass with the browser-wide collector observer. The final complete suite and current commit/run IDs are recorded in the PR and measurement report; a callback is never accepted in place of a collector payload. |
| Netlify hosted preview | Provider reports preview build success. Direct access to preview #18 returned HTTP 401 on November 18. The existing browser session also could not acquire preview access: automatic approval review rejected attempted access to `app.netlify.com` outside the named preview origin because it could expose a private dashboard. No preview DOM was returned. Hosted page behavior remains unverified. |
| Live production | Five requested routes and Autumn byte-matched exact main at 12:33:39 p.m. PST on November 18. Real public scheduling was inspected separately. This candidate has not been merged or deployed to production. |

The UI was exercised at 1440, 768, 390 and 320 pixels. At 390 × 844, the Tri-Cities
primary action spans y=431.19–511.97 and is fully on the first screen. Desktop
and mobile screenshots were visually reviewed; focus indicators and the final
footer utilities are readable. Local Chromium cannot start because its
process-singleton socket is denied, so local VM results are not represented as
local browser passes.

The passing UI and real-scheduler artifacts are linked from PR #18. Candidate
screenshots do not establish hosted-preview access, initial-evaluation
availability, production GA4 receipt, or a confirmed appointment.

## Separate GA4 receipt check

At 12:58:55 p.m. PST on November 18, an authenticated, uncached, read-only Supermetrics
query reached property `558962239` using only aggregate date, event name and
event count for November 17–18. It confirmed existing page-view receipt but did
not verify any scheduling-candidate event. Missing current-day event rows are
not a verified zero because standard reports can lag. No patient-level
dimensions, new events, settings, or advertising writes were involved.

Credentials are available. The exposed connector does not document a Realtime
or DebugView operation. The repository's existing live diagnostic permits a
consented homepage view only after deployed assets match `main`; it does not
authorize a new pre-release scheduling-event send. Candidate receipt therefore
remains a separate post-release verification under an approved controlled
scheduling diagnostic. See Google's
[data freshness guidance](https://support.google.com/analytics/answer/11198161).

## Remaining release actions

1. Clinic Manager: confirm/expose the intended new-client evaluation service and
   Telehealth path in SimplePractice, plus roster and payer details.
2. Clinical/content reviewer and owner: review this candidate and record the
   exact revision-specific approvals before a production release.
3. Authorized preview reviewer: open preview #18 through permitted Netlify
   access and verify the hosted candidate; the build success and local CI
   screenshots do not resolve its access restriction.
4. Require the final actual-library transport CI result on the candidate,
   then follow the existing owner-controlled release process. After release,
   verify the live revision and separately confirm the approved diagnostic in
   GA4 property `558962239`. Keep accepted appointments and attendance
   reconciliation in the protected practice/Operations process.

Local service ads remain on their existing destinations. Once approved and live,
the Individual and Couples pages can be considered for a separately authorized
destination test; this work does not change their advertising URLs.
