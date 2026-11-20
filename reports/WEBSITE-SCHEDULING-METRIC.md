# Website scheduling measurement contract

## The reported metric

Use **Website scheduling-link click** as the display name for
`simplepractice_exit`. It means a visitor activated an eligible native
new-client link to SimplePractice. Count that handoff once; do not add the
other scheduling events to its total. Delivery is best effort and never delays
the native navigation.

| Event | Reporting role | Meaning |
| --- | --- | --- |
| `simplepractice_exit` | Website scheduling-link click | Eligible native handoff to SimplePractice, including the optional introduction dialog's enabled Continue link |
| `appointment_request_click` | Diagnostic only | General appointment or evaluation action |
| `clinician_schedule_click` | Diagnostic only | Clinician-specific action, without clinician identity in the measurement payload |
| `consultation_click` | Diagnostic only | Consultation action, which can be just an optional-dialog opening |

Opening, closing, or canceling the introduction dialog and checking its
acknowledgment do not count as a handoff. Its enabled Continue navigation does.
Existing-client sign-in is excluded. There is no additional `scheduling_click`
event or alias.

A scheduling-link click does not establish that SimplePractice received a
request, confirmed an appointment, or recorded attendance. Authoritative
practice records may later establish those outcomes in Ops; they cannot
reconstruct an unobserved website click.

## Separate current delivery paths from the disabled legacy collector

`MFT_BOOKING_CONFIG.measurementEnabled` remains `false`. It belongs to the
older first-party booking/Ops collector design. That collector has no configured
website endpoint and remains disabled. The flag does not control the current
consent-required GA4 path.

The current path has these consumers:

1. `src/assets/mft-booking.js` classifies eligible native actions and calls
   `MFTSchedulingMeasurement.track`. Booking does not wait for a callback.
2. `src/assets/mft-analytics.js` defines that entry point. It requires consent,
   applies the event/placement allowlists, and sends a minimized intent to the
   same-origin helper.
3. `src/assets/mft-ga4-frame.js` revalidates and deduplicates those intents,
   then uses the isolated Google library. The helper acknowledgment means
   processing, not GA4 receipt.
4. When `OPS_HANDOFF_COLLECTION_ENABLED=true` in an eligible production build,
   that same consent controller sends only the qualifying `simplepractice_exit`
   action to the existing `https://ops.mft.care/api/marketing/attribution`
   receiver. It has a separate random action UUID and never depends on the
   Google helper loading or acknowledging a message. The legacy collector flag
   stays false. Diagnostics are not sent as Ops handoffs.

`src/booking-core.js` still exports the legacy `shouldMeasure` and acquisition
helpers for compatibility. Current booking and GA4 runtime code do not call
them. The new handoff path reuses the existing receiving endpoint with a strict,
versioned contract; it does not enable the legacy payload or its collection flag.

GA4 installation is separately gated by the production context, indexing
approval, and `GA4_BASIC_MEASUREMENT_ENABLED=true`. Even with a true build flag,
only eligible approved pages receive the controller, and each visitor still
needs the required consent. Preview, draft, sensitive-route, GPC/DNT, refusal,
and revocation protections remain in effect.

## First-party handoff envelope

The existing Ops endpoint receives this contract only after explicit
`mft.analytics.consent.v4=granted`, with GPC/DNT overriding consent. The v4 notice
names both M.F.T. internal handoff measurement and Google Analytics. Earlier
Google-only grants require a fresh choice; the latest earlier refusal remains
effective. Withdrawal propagates to earlier consent keys for already-open tabs.
The remembered account acknowledgment is functional state and is unchanged.

| Field | Contract |
| --- | --- |
| `schemaVersion` | `1` |
| `eventType` | `simplepractice_exit` only |
| `eventId` | Secure random UUIDv4, generated once for the actual handoff |
| `occurredAt` | UTC action timestamp in ISO 8601 format |
| `consentVersion` | `mft.analytics.consent.v4` |
| `source`, `medium` | Existing enumerated pairs only |
| `campaignId` | Optional string containing one of the seven approved numeric campaign IDs; only for `google/cpc` |
| `pageCode` | Existing opaque 16-hex page code |
| `placement` | `header`, `footer`, `body`, or `dialog` |

The currently approved campaign IDs are `24274542446`, `24362234053`,
`24435101888`, `24444626634`, `24449945489`, `24530528782`, and `24524392745`.
This version does not admit ad-group or creative IDs. The historical unused
parser's broader fields are not evidence of an active approved collection path.

No visitor/session ID, patient identity, contact detail, clinician ID, clinical
information, form value, SimplePractice record ID, raw URL/referrer, keyword,
or raw Google click ID is part of the envelope. The handoff UUID is never sent
to Google or added to a SimplePractice destination.

The controller sends a credential-free, no-referrer, keepalive POST. It retries
at most once after a transient network/server failure, using the identical
serialized envelope and UUID. A retry requires the same still-valid consent
generation and a visible document; withdrawal aborts pending delivery and
invalidates scheduled retries. There is no persistent retry queue. Delivery is
best effort; native scheduling never waits, even if either measurement path
is absent, blocked, or fails.

The receiving table's existing unique event ID makes repeated delivery one row.
A successful collector response establishes receipt only; it does not establish
appointment-request verification or attribution.

Source acquisition remains limited to 30 minutes in session storage. Internal
navigation preserves a known source and its original deadline, without renewal.
Expiry or withdrawal clears it; a later handoff does not reuse an expired
campaign. The recorded handoff retains the permitted source at the time of its
action. New handoff rows use a 30-day reporting retention period, with physical
deletion during ingestion and authenticated daily cleanup. Legacy records and
protected SimplePractice retention are not changed by this policy.

## Protected request verification and attribution

| Reporting state | Required evidence |
| --- | --- |
| Website scheduling handoff | One qualifying `simplepractice_exit` recorded by the applicable receiver |
| Verified appointment request | An actual SimplePractice request verified by the protected existing Ops import/workflow |
| Attributed verified request | Verified request plus a demonstrated source connection |
| Accepted or confirmed appointment | An authoritative SimplePractice record explicitly supporting that state |

A verified request with no demonstrated source remains verified, with source
`Unknown` or `Unmatched`. It must not disappear from request counts merely
because it has no advertising connection. A scheduled or billed appointment
snapshot does not by itself establish an earlier online request, its submission
time, or its acceptance time.

The new website UUID identifies a single delivery action; it is not a
SimplePractice request identity. No match may be inferred from a name,
clinician, appointment date, or temporal proximity. The existing protected
identity-link mechanism may be used only when its own verification evidence
exists. This website change supplies no such link and creates no automatic
request attribution.

The missing connection is a supported, demonstrated way to carry the opaque
website action/source reference through SimplePractice and return it alongside
an authoritative stable request identifier in the protected Ops workflow.
Until that connection is demonstrated, website handoffs and verified requests
remain separate records. Do not invent a custom portal parameter, scraping
match, callback, or Google conversion export to close this gap.

## Reading generated reports

The existing top-level booleans remain compatible. The shared `measurement`
metadata in the booking, analytics, and review-build reports makes their scopes
explicit:

| Report field | Interpretation |
| --- | --- |
| Booking/review `measurementEnabled` | Legacy booking collector only; remains false |
| `measurement.legacyBookingCollector.enabled` | Explicit legacy collector state |
| `measurement.consentControlledGa4.buildEnabled` | Whether the current build enables the consent-required GA4 integration; not visitor consent or delivery |
| `measurement.consentControlledOps.buildEnabled` | Whether the current build installs the separately gated first-party handoff destination; not receiver readiness or event receipt |
| Analytics `opsHandoffPages` | Generated eligible-page inventory for the internal handoff path; not a count of events |
| Analytics `enabled` | Existing GA4 build gate; unchanged |
| Analytics `injected` / `finalPages` | Generated page inventory, not recorded visits |
| Analytics `finalVerified` / `finalVerifiedScope` | Generated HTML inventory, route eligibility, and page identities were checked; not collector or account receipt |
| `measurement.schedulingMetric` | Display name, source event, counting boundary, and diagnostic exclusions |
| `measurement.externalVerification` | External collector/account outcomes are not established by these build reports |

Production can correctly report the legacy flag as false and the two current
build gates as true. None proves that a visitor consented or that a hit arrived.

## Keep the evidence levels separate

| Evidence | What it can establish |
| --- | --- |
| Generated HTML and report validation | Correct installation, route eligibility, and artifact inventory |
| Synthetic browser/runtime test | The tested action and consent behavior |
| Intercepted outbound request | An outgoing minimized request was generated in that test |
| Real collector response | That request reached the collector and received a response |
| GA4 property read-back | The event was received and surfaced in the property |
| Google Ads configuration and attributed receipt | A website action is configured and attributed conversions are being reported |
| Authoritative appointment record | Requested, confirmed, or attended care as supported by that record |

An allowlisted numeric campaign label is aggregate source information. It does
not prove Google Ads click attribution. Raw click identifiers remain excluded;
advertising consent and enhanced conversions stay disabled. Until a permitted
integration is verified, report Google Ads Clicks separately from GA4 scheduling
counts. Do not label the diagnostics or a combined event total as conversions,
and do not infer a configured Ads action from website code.

GA4 measurement ID `G-BTK39BBNRE`, property `558962239`, and Google Ads account
`420-172-2474` remain the existing destinations. The website does not configure
key events, conversion actions, campaign goals, bids or budgets. Keep the single
primary website handoff conversion at Count: One, calls secondary/excluded from
optimization, and the existing $10 maximum CPC and budgets. Internal source
information is not proof of Google Ads-attributed conversion receipt.

This document defines website reporting semantics and the receiver contract.
Release evidence must separately establish production configuration, collector
receipt, database idempotency, protected request verification, source matching,
and any Google account receipt. It records no new appointment outcome.
