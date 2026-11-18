# M.F.T. website marketing implementation — November 18, 2026

## Candidate and release boundary

Implements `MFT_Website_Marketing_Improvements_2026-11-17.md` on exact current
main `ef336ae9d12423273d598e247bdf1adf32e71dca`. This is a review candidate;
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

At `2026-11-18T20:33:39Z`, the five requested public HTML routes plus Autumn's
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

- Local full build/unit suite: passing; exact final count is recorded in the PR.
- Isolated publication rehearsals: preview default, accidental preview indexing,
  and production policy all pass; 829 HTML pages and the pre-existing 251 draft
  catalogue warnings remain. No warning threshold was relaxed.
- Independent marketing-only scope audit: exactly five review-page bodies
  changed across 829 outputs. With approvals pending, production page content
  matches the baseline after normalizing the shared stylesheet version; teen,
  Autumn and Taylor content remain unchanged.
- Local Chromium cannot start because its process-singleton socket is denied.
  Unit/VM checks are not called local browser passes.
- Hosted CI candidate browser suites and real Google-library/intercepted-collector
  transport checks are required on the actual PR revision. Their results must
  be recorded separately from local and production evidence.
- The existing PR #14 hosted Netlify preview returns HTTP 401. The new PR's
  preview must be checked independently; no protection is disabled or bypassed.
- Production GA4 receipt in property `558962239` is not verified by these local
  tests or by intercepted collector traffic. No confirmed appointment was created.

## Remaining release actions

1. Clinic Manager: confirm/expose the intended new-client evaluation service and
   Telehealth path in SimplePractice, plus roster and payer details.
2. Clinical/content reviewer and owner: review this candidate and record the
   exact revision-specific approvals before a production release.
3. Browser verification: require successful candidate layout/navigation and
   actual-library transport CI; record any protected-preview limitation.
4. After an authorized release: verify the live page revision and separately
   confirm permitted synthetic diagnostic receipt in GA4 property `558962239`
   using the approved procedure. Keep actual accepted appointments and attendance
   reconciliation in the protected practice/Operations process.

Local service ads remain on their existing destinations. Once approved and live,
the Individual and Couples pages can be considered for a separately authorized
destination test; this work does not change their advertising URLs.
