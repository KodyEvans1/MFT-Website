# Google attribution and Ops source verification

Prepared November 25, 2026; Ops source state refreshed November 26 at 12:05 a.m. America/Los_Angeles.

## Result

The eligible website repair is merged and deployed. Google acquisition attribution remains **blocked**, and a missing appointment source remains a separate Ops dependency. Deployment, an Ops receipt, GA4 processing, Ads import and natural ad attribution are distinct evidence stages.

The implementation continued [PR26](https://github.com/KodyEvans1/MFT-Website/pull/26), including the independently identified native-tab-return correction in commit 345b8248c53768f4c8df332ca79140cfeb21c55e. The existing owner completed the supported real-browser harness and merged the repair. [PR27](https://github.com/KodyEvans1/MFT-Website/pull/27) contains the separately completed acquisition UX work.

This closeout records current account and source findings and refreshes the generated site files required by README. It introduces no additional Google sender, conversion action, patient record store or application behavior.

## Application release evidence

| Item | Verified application release |
|---|---|
| Repair PR26 merge | 44b335850e27779e4e9183b1b22246157c2ada7f |
| Subsequent UX PR27 merge | 48f5fd48bad90d0149fa07b4799a1572b1a88a22 |
| Netlify deployment for that release | 6b07da6c17dfb82b623205b8 |
| Build time | November 25, 11:06:31 p.m. Pacific |
| Google policy | Version 2; blocked-sensitive-context; zero approved routes/events |
| Google collection | Disabled |
| First-party controller and Ops | Enabled on 60 eligible pages; a page count, not conversions |
| Sitemap | 63 URLs; 757 draft SEO routes remain outside the approved indexing set |

The [public release record](https://www.mft.care/reports/release-provenance.json) supplies the latest deployment commit. Later generated-file/evidence-only commits must be distinguished from the application release above and verified against their own public manifest.

The final repair candidate 9c760058046b04b2e6875ba1a3de172faf437e2a passed all eight applicable workflows before merge. The [real headed-tab gate](https://github.com/KodyEvans1/MFT-Website/actions/runs/45771782399) passed 44 assertions: both fixtures observed trusted hidden/visible transitions in the original document, each allowed four native scheduler navigations, and each counted two distinct Ops handoffs across a genuine return. Google was zero in the production-disabled fixture and two only in the isolated conditional fixture.

The [hosted privacy gate](https://github.com/KodyEvans1/MFT-Website/actions/runs/45771782303) passed 823 assertions with 379 intercepted requests and no blockers, browser errors or interception errors. Its 97 intended Google requests were fulfilled locally. It used Chromium 158.0.8127.36 and public vendor SHA-256 b0e082726d45f1ef477bddd8d37bcc639736b084f8faa003cea87d21cb418251. These are intercepted implementation checks, not Google receipt.

Production closeout on PR26 separately records 16 passing UX cases and 14 privacy checks from fresh public-response snapshots, with zero Google requests, handoffs or unexpected writes. The response bodies and security headers were replayed locally after matching 26 artifacts to the public release manifest. Earlier download failures and the actual /start/ 404 were retained; the working starting-care URL is /how-to-start-therapy/#individual-journey.

No paid ads were clicked, no production scheduler Continue was activated, and no real appointment or synthetic production acquisition conversion was created.

## Five evidence stages

| Stage | Finding |
|---|---|
| 1. Popup and handoff behavior | Passed in isolated native-browser tests; published source and nonconverting production behavior separately checked. |
| 2. Outgoing permitted Google requests | Production block verified. The conditional request inventory is observed but remains unapproved; there is no approved live Google payload. |
| 3. Intended GA4 property/stream processing | Historical 14 handoff events and 10 key events verified. Current repaired-production receipt is not established while collection is blocked. |
| 4. Existing Ads action receipt | Not demonstrated by the action-specific query; the action displays Awaiting conversions. |
| 5. Natural, consented handoff attributed to its originating ad | Not demonstrated. Returned native Ads attribution dimensions are unset; natural origin and individual consent are not established. |

Stages 3–5 are not merely waiting for more traffic or processing while Google collection remains blocked.

## Fresh canonical account readback

Authenticated reporting reads and direct Google Ads/Analytics admin inspection were performed November 25. This closes the earlier reporting-connector gaps noted in the implementation review. These settings were read, not changed.

| Component | Verified value |
|---|---|
| Google Ads customer | 4201722474 |
| GA4 property | 558962239 |
| Web stream / measurement ID | 16124767332 / G-BTK39BBNRE |
| Canonical event | simplepractice_exit |
| Existing imported action | 7911303814; enabled GA4 custom event, website/outbound, primary and included |
| Ads count | One per click |
| Value | Do not use a monetary value |
| Attribution | Data-driven; Google paid channels |
| Windows | 90-day click-through; 3-day engaged-view |
| Outbound account-default goal | 7 of 7 configured campaigns, including the paused campaign |
| Custom goals | None |
| Calls action | 7319819489; secondary and excluded |
| Phone-call goal | 0 of 7 campaigns |
| Auto-tagging | Enabled |
| Currency/timezone | USD / America/Los_Angeles |

A separate locked Business Profile tracked-call action appears primary within the unused phone goal but is excluded from account-level goals. It does not replace the scheduler-handoff acquisition goal. No second enabled primary action for the same handoff was found.

| GA4 control | Verified current state |
|---|---|
| Link to Ads 4201722474 | Completed; personalization disabled |
| Property advertising personalization | Allowed in 0 of 307 regions |
| Google Signals | Off |
| Enhanced Measurement | Off |
| simplepractice_exit | NPA key event; once per event |
| Additional connected site tags | Zero |
| Event retention | 2 months |
| User retention | 14 months |
| Reset on new activity | On |

The proposed two-month user retention and reset-off settings have **not** been applied. A later activation must satisfy its documented review conditions and recheck account settings at that time. A general stream traffic notice does not prove handoff receipt.

### Budgets and bidding preserved

All six active campaigns remain Maximize Clicks/TARGET_SPEND with a $10 CPC ceiling. The paused historical campaign also retains $10.

| Campaign | Budget |
|---|---:|
| Emily Johnsrud | $5/day |
| Autumn Alexander | $5/day |
| Sonia Hassan | $5/day |
| Gary Ashley | $5/day |
| Tri-Cities pilot | $15/day |
| Woodinville–Bothell ongoing | $28.57/day |
| Historical Adult Individual pilot — paused | $200 lifetime |

The six active campaigns retain Google Search, disabled search partners/display, presence geography and four campaign sitelinks. Woodinville's /new-page/ and /marriage-and-couples-therapy-counseling/ destinations are preserved. This task made no account, campaign, budget, CPC, targeting, keyword, negative or ad-setting changes.

## Receipt and attribution queries

The January 1–November 25 GA4 query returned the following in property 558962239 / stream 16124767332:

| Date | simplepractice_exit events | Key events |
|---|---:|---:|
| November 19 | 4 | null / unavailable |
| November 20 | 5 | 5 |
| November 21 | 2 | 2 |
| November 22 | 1 | 1 |
| November 23 | 2 | 2 |
| Total returned | 14 | 10 |

Null is not zero. No November 24–25 handoff rows were returned. All 14 session-scoped handoffs and all 10 event-scoped key events have native Ads customer/campaign dimensions unset; ad-group dimensions are blank. A manually assigned google/cpc label is not native Ads attribution.

The Ads query restricted to action 7911303814 for January 1–November 25 returned **no receipt rows** for conversions/all-conversions and conversion-date equivalents. Do not replace that result with an invented numeric zero. The admin UI for November 18–24 separately displays 0.00 and Awaiting conversions.

Two historical calls in the broader November report occurred November 10 and 11. Those historical outcomes do not change the currently verified secondary/excluded calls setting.

## Exact collection boundary and remaining decision

There is **no approved live Google payload**. The conditional proposal covers only / and /about/, including an actual generic new-client scheduler handoff. It does not cover the existing clinician/service landing pages or the two current Woodinville ad destinations.

The proposed browser flow includes simplepractice_exit, the reviewed public URL, a generic GA4 title, actual public document title exposed in linked measurement, native client/session and genuinely present click context, consent/protocol/device fields, ordinary network/IP metadata, automatic engagement/session markers and potentially existing Google/DoubleClick cookies. Excluding patient names does not make this combination anonymous.

Inspected request classes include the public tag loader, GA4 collection, linked measurement at www.google.com/measurement/conversion, DoubleClick identifier/consent pings, and sampled /a, /td and is_td diagnostic-script requests. The inspected mde field summarizes registered transport attempts by configured destination and numeric endpoint. The fixture distinguishes the exact id-only library loader from the supplemental diagnostic request and uses an explicitly empty local sink for the latter. Google's actual supplemental response, response-driven code, server processing and downstream behavior remain unverified.

No patient names/contact details, diagnoses, clinical selections, appointment/client/payment IDs, attendance, revenue, refunds, form answers or Ops receipt IDs may be exported to Google. Renaming, hashing, a helper frame, a server relay or offline outcomes cannot resolve the underlying disclosure.

The single external collection decision is:

> Can the practice's qualified privacy reviewer, with Google product-policy clarification where needed, establish that this exact versioned care-seeking event, provider context, native identifiers, automatic requests, cookies, recipients, purposes and retention are permitted under Google's sensitive-information/PHI rules and the practice's applicable obligations, and identify any exact restrictions or changes required?

Google Analytics' sensitive-information and PHI restrictions are separate from personalized-targeting restrictions. HHS' partial vacatur means a public provider-page visit plus IP is not automatically PHI on that basis; this handoff needs its own contextual classification. Washington's definitions, collection/sharing rules and information-specific exemptions also require an applicable assessment. Consent alone does not override a prohibited product use.

## Authoritative SimplePractice / Ops source state

Ops main remains 3b3a98d131582c47ba5fed5d6006ad82a7ace58e. A fresh aggregate production read at November 26, 12:05 a.m. Pacific confirms:

- Zero normalized source accounts, imports and current records.
- Zero legacy outcome events and identity links.
- Zero stable-ID appointment import batches and appointments.
- One ordinary practice-report snapshot and four supplemental snapshots.
- Eight schema-v1 simplepractice_exit receipts, all within the 30-day reporting window.

The eight receipts are website handoffs, not eight booked or acquired clients. None contains the checked legacy browser/session, click-hash, path/referrer, ad-group or creative fields. The earlier public endpoint preflight returned 204 with the handoff contract enabled; the aggregate refresh did not repeat that HTTP check.

The existing receipt contract uses schemaVersion, eventType, one-action eventId, occurredAt, consentVersion, normalized source/medium, optional allowlisted campaignId, pageCode and placement. A retry reuses the action ID; server deduplication preserves one receipt. This is not an identity bridge to appointments or proof of native Google attribution.

### Source mapping

| Required source fact | Available evidence | Missing dependency |
|---|---|---|
| Stable person/case/member IDs | Labels in ordinary reports | Verified source IDs and membership mapping |
| Stable request/appointment IDs | Supported normalized import contract | IDs absent from the inspected ordinary Attendance/Appointment Status exports |
| Request submission/status | SimplePractice Requests workflow | Supported source feed and actual field mapping |
| Booking acceptance | Canonical importer can store acceptedAt | Actual system/staff acceptance timestamp |
| Attendance | Client, Clinician, Date of service, Location, Status | Stable joins and certified coverage |
| Service classification | Appointment Status Billing Code | Authoritative appointment join and deployment of the reviewed classification |
| Payment identifiers | Local PaymentExport sample includes Payment ID and Payment Reference ID | Verified scope/lineage; no production PaymentExport receipt |
| Cash dates/allocations | Date Paid, Date Received and allocation-report fields | Event semantics, timezone and stable allocation mapping |
| Refunds | Some formats contain refund labels/signed adjustments | Original receipt link, actual refund timestamp, allocation and complete coverage |
| Ad-to-clinical link | Existing protected internal contract | No verified populated bridge |

An upload receipt's acceptedAt is upload acceptance time, not booking acceptance. Scheduled service time, a name/alias, a clinician match, nearby timestamps or a contact hash cannot replace the missing source facts.

The ordinary November 20 snapshot has observed service dates October 20–November 20, provisional-name-label identity and no certified year-to-date coverage. Report rows are not unique people, accepted bookings or a payment ledger. The normalized preview/confirm importer at /api/marketing/outcomes/import is reusable, but it is not a connected SimplePractice feed. The request contract explicitly identifies SUPPORTED_REQUEST_SOURCE_BRIDGE_REQUIRED; with no account connected, the outcome API returns report:null.

SimplePractice's documentation distinguishes Requests from Attendance/Appointment Status, says full client exports omit appointments, and states it currently has no public-facing integration API. No qualifying supported request/acceptance source has been identified for this practice.

First, obtain SimplePractice's confirmation of whether a supported export or integration can provide the stable IDs, actual request/acceptance timestamps, attendance semantics, correction/reschedule rules and January 1 forward coverage. If available, verify the field meanings and map that source into the existing importer. Do not request a full-chart export or manually reconstruct advertising attribution per client.

Keep patient-level reconciliation in SimplePractice/Ops. Unsupported metrics remain unavailable with a named missing source. Existing ordinary report summaries remain valid; the additional 2026 aggregate/reporting work in Ops PR38 remains separate and unfinished.

### Reporting-period and service-code decisions

Report January 1, 2026 onward. Preserve the owner-confirmed stable meanings: 00 and 00000 are free consultations; 03 is 15 minutes of non-covered clinical services. No repeated confirmation of those meanings is needed.

History limited to January 1 onward cannot certify a lifetime-new person or case. First observed in 2026 is a separate description when supported; no outcome is inferred from missing history.

Seven targeted Ops suites previously passed 147 tests with zero failures and six conditional legacy database skips. The new handoff endpoint-to-repository-to-isolated-PostgreSQL cases did run, including deduplication and minimization. These tests are not evidence of a connected appointment feed.

## Primary references

- [Google Analytics sensitive-information and HIPAA requirements](https://support.google.com/analytics/answer/13297105?hl=en)
- [Google health-personalization policy](https://support.google.com/adspolicy/answer/16701855?hl=en)
- [HHS tracking guidance and partial-vacatur notice](https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/hipaa-online-tracking/index.html)
- [Washington definitions](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373.010)
- [Washington collection/sharing rules](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373.030)
- [Washington exemptions](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373.100)
- [SimplePractice Requests](https://support.simplepractice.com/hc/en-us/articles/41929603998605-Managing-appointment-requests)
- [SimplePractice attendance and appointment reports](https://support.simplepractice.com/hc/en-us/articles/13218379819661-Understanding-your-clients-and-appointments-reports)
- [SimplePractice export limits](https://support.simplepractice.com/hc/en-us/articles/207625506-Exporting-client-information-through-data-exports)
- [SimplePractice public API statement](https://support.simplepractice.com/hc/en-us/articles/360034957931-Comparing-SimplePractice-features-by-plan)
- [Versioned website measurement review](https://github.com/KodyEvans1/MFT-Website/blob/48f5fd48bad90d0149fa07b4799a1572b1a88a22/reports/GOOGLE-MEASUREMENT-REVIEW-20261125.md)
- [Ops normalized source contract](https://github.com/KodyEvans1/mft-operations/blob/3b3a98d131582c47ba5fed5d6006ad82a7ace58e/docs/normalized-outcome-source-contract.md)
