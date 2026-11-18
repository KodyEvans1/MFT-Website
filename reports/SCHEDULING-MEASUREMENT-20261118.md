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
escape through DNS. The next bounded harness correction uses one browser-target
CDP Fetch interceptor for all requests, replacing Playwright's frame-dependent
routes. It requires the complete request body before payload validation and
keeps the same event counts and privacy assertions. The page-target diagnostic
also missed unload lifecycle and requests, so that evidence alone does not
establish whether Google attempted the final batch. The exact
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
no live appointments. Record its candidate SHA and outcome before release.

Outgoing request observation, Google collector acceptance, receipt in GA4
property `558962239`, and an actual confirmed appointment are separate facts.
This code and the controlled tests do not establish production GA4 receipt or
an appointment. Until the real-browser gate and current release/content gates
pass, this remains a review candidate.
