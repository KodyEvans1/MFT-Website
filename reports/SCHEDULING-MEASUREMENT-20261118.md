# Scheduling measurement candidate — 2026-11-18

## Scope and authorization

This candidate selectively carries forward the narrow scheduling-intent design
from PR #11 and the November 17 marketing brief. It does not merge that stale
branch, modify advertising settings, enable a separate Ops collector, or expand
the approved data payload. Existing production release gates still apply.

## Event definitions

| Event | Meaning | Canonical handoff? |
| --- | --- | --- |
| `appointment_request_click` | A native general appointment action | No |
| `clinician_schedule_click` | A native clinician-specific appointment action, without clinician identity in the payload | No |
| `consultation_click` | Opening the optional 10-minute information dialog, or following a direct consultation action | No |
| `simplepractice_exit` | Activating a native SimplePractice appointment link; for the dialog, only its enabled Continue action | Yes, an attempted handoff only |

Closing or canceling the dialog sends no handoff. These diagnostic events must
not be summed as appointments. No event establishes a submitted request,
confirmed appointment, attendance, acquired client, or revenue.

## Privacy and delivery

Google remains in the existing empty same-origin helper. A new v3 choice is
required; a prior v2 grant does not silently authorize scheduling measurement,
and a prior refusal, Global Privacy Control, and Do Not Track remain respected.
The helper accepts only coded page identity, approved source/medium, an
allowlisted campaign ID, approved event names, and one of four placements.
Current IDs `24362234053`, `24435101888`, `24444626634`, and `24449945489` are
allowlisted at both boundaries, and historical `24274542446` is retained.

No clinician identity, raw originating URL/query, click identifier, form entry,
appointment reason, or patient-linked outcome crosses that boundary. Limited
consented source data expires after 30 minutes and is removed on refusal.
Advertising consent, personalization, Google signals, and enhanced conversions
remain disabled. Coded data is not described as legally de-identified.

Native booking anchors never wait for a tag callback or collector. A ready
same-origin helper receives the minimized intent synchronously to avoid the
queued-postMessage/navigation race; it revalidates and deduplicates the payload.
Optional diagnostic callbacks have no authority over navigation. Measurement
is best effort: a blocked or unloaded tag may produce no event while scheduling
continues. A callback indicates processing, not Google receipt.

The first real-browser candidate reproduced the missing handoff even with
synchronous helper delivery. Its trace established that Google processed the
event and called its callback before navigation, while collector interception
observed no handoff request. A second experiment restricting `fetch` in the helper did not improve
the observed result and was removed. The diagnostic now observes the helper's
native transport calls, lifecycle, browser requests, and independent CDP
network events. Because Playwright can auto-continue requests after a frame
detaches, the browser also disables proxy use and denies all DNS resolution.
A request to a real collector hostname must fail with `ERR_NAME_NOT_RESOLVED`
before any routes or event scripts are installed. The current Google library
is fetched separately without browser data and served byte-for-byte to the
test browser, with source URL and SHA-256 recorded in its artifact. Ordinary
collector/scheduler routes remain intercepted; an orphaned request cannot
escape through DNS. The verified harness uses one browser-target
CDP Fetch interceptor for all requests, replacing Playwright's frame-dependent
routes. It requires the complete request body before payload validation and
keeps the same event counts and privacy assertions. Run `44397578578`, candidate
`15698674c7b1f6b6ea91f0173deb0251c8f79c34`, captured the complete batch with two
dialog-open events and exactly one handoff while page-scoped observers missed
that batch. Both the original Continue and keyboard-footer assertions passed.
The remaining failure selected Sonia's paid couples-consultation shortcut when
the test intended her primary clinician action; its consultation event was
correct. The test now targets the hero action precisely and separately verifies
the paid consultation's distinct event type. The inherited `transport_type`
setting was removed after the actual SDK serialized it as custom event metadata,
and the payload gate allows only the two approved intent-specific custom fields.
The exact
one-handoff assertion remains a release gate; an invoked tag or callback alone
does not satisfy it.

## Verification boundary

Targeted VM/unit checks exercise payload rejection, campaign allowlists,
consent/refusal/expiry, direct-frame deduplication, duplicate script execution,
native navigation despite throwing or stalled analytics, and explicitly marked
evaluation cards whose supporting prose mentions insurance or assessment.

The original PR #11 failure reached SimplePractice with no observed
`simplepractice_exit`. Its subsequent diagnostic had a JavaScript syntax error.
The repaired browser gate retains the exact one-handoff assertion and uses a
separately syntax-checked trace fixture. The CI workflow uses installed Chrome,
avoiding the unrelated browser-download installation failure.

Local Chromium execution is unavailable in this workspace because its process
singleton socket is denied. Consequently local VM/build results are not a
browser transport pass. The controlled CI browser uses freshly fetched actual
Google tag bytes, intercepts collection and scheduler navigation with an
independent browser DNS backstop, and creates
no live appointments. The completed candidate evidence is recorded below.

## Verified candidate — 2026-11-18

[Workflow run 44400475025](https://github.com/KodyEvans1/MFT-Website/actions/runs/44400475025)
and [measurement job 135141782526](https://github.com/KodyEvans1/MFT-Website/actions/runs/44400475025/job/135141782526)
passed on test commit `0ec4c2bad6ec98ad3de20c60e008594093e2b8cd`.
The website runtime is unchanged from `bd8633a9d2dcddf870320c4f0d4eba36eee38efa`;
the later changes correct the browser test fixtures and observation harness.
This was an isolated CI build served at the production origin by interception,
with the pending marketing copy still excluded by its production approval gate.
It was not a production deployment.

All **21 real-library browser checks passed**, with **zero interceptor errors**
and **zero canceled resources** in the final result. The suite observed 271
requests across three isolated browser processes. Each GPC/DNT case uses a fresh
process so an earlier consented case's browser-owned keepalive request cannot
contaminate its exact zero-tag-load/zero-hit assertion. The blocked-collector
case measures the completed native navigation before waiting to observe its
aborted collection attempt. The test never makes navigation wait for analytics.

| Check group | Count | Verified result |
| --- | ---: | --- |
| Consent and refusal | 6 | Fresh choice after a legacy grant; legacy refusal preserved; mobile booking after refusal; GPC and DNT override a stored grant; revocation clears source and removes measurement while booking remains usable |
| Attribution and minimized payload | 2 | Allowlisted paid source with no sensitive query/click identifiers; consented source persists across an internal page navigation |
| Scheduling intent and handoff | 5 | Dialog open/cancel produces no handoff; Continue, keyboard general request, paid couples consultation, and Sonia's primary clinician action each produce their exact expected subtype/handoff counts |
| Optional analytics failures | 4 | Native navigation completes within the existing 1.5-second test bound with a blocked Google tag, missing optional controller script, throwing measurement function, and blocked collector |
| Sensitive routes | 4 | No measurement on `/check-my-coverage/`, `/marriage-reset-assessment/`, `/start/`, or `/marriagereset/` |

Every intercepted collector request passed the complete-body and privacy gates.
The only explicit custom fields allowed on an intent event are
`ep.button_location` (`header`, `footer`, `body`, or `dialog`) and
`ep.measurement_kind` (`scheduling_intent`). Other `ep.*`, `epn.*`, `up.*`, and
`upn.*` fields are rejected, and the default events permit no such custom fields.
The checks also require the correct measurement ID, coded page identity,
generic page title, and non-personalized advertising flag. They reject raw
click identifiers, free-text query values, clinician identifiers, form fields,
and completed-booking event names. The removed `transport_type` field is absent.

The separately downloaded current Google library was 545,261 bytes, SHA-256
`7390733e3948ae9c59426b71b89999b62174ef958f885bbca865df63bb049397`, from
`https://www.googletagmanager.com/gtag/js?id=G-BTK39BBNRE`. It was served unchanged
to the DNS-denied browser. No canned or mocked Google library was used.

The diagnostic artifact independently records `page_view`, two deliberate
`consultation_click` events, and exactly one `simplepractice_exit` in complete
browser-target collector requests. The simultaneous page-target CDP observer
saw only `page_view`, confirming the old observer's unload blind spot. The
original one-handoff assertion now passes without delaying or intercepting
the product's native booking action.

[Artifact 14473035114](https://github.com/KodyEvans1/MFT-Website/actions/runs/44400475025/artifacts/14473035114),
`scheduling-measurement-verification`, contains `result.json`,
`transport-probe.json`, and the build's analytics integration report. The ZIP
was downloaded and its SHA-256 verified as
`89668d668af5be69c7c9737168de1085c12c3bb000119f7a1e4a2efda2498658`.
The same workflow also passed the 327-check repository suite, all three
publication rehearsals, and six harness regressions, including complete-body
enforcement and continued failure on collector/script/navigation errors.

Outgoing request observation, Google collector acceptance, receipt in GA4
property `558962239`, and an actual confirmed appointment are separate facts.
This code and the controlled tests establish generated, intercepted collector
requests; they do not establish production Google collector acceptance,
receipt in GA4, or an appointment. The browser gate has passed. Current content
approval and production release gates still apply, so this remains a review
candidate until those separate gates are satisfied.
