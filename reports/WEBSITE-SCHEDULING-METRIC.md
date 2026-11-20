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

## Why a false booking flag can coexist with GA4

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

`src/booking-core.js` still exports the legacy `shouldMeasure` and acquisition
helpers for compatibility. Current booking and GA4 runtime code do not call
them. Do not enable an Ops collector to make the GA4 scheduling metric work.

GA4 installation is separately gated by the production context, indexing
approval, and `GA4_BASIC_MEASUREMENT_ENABLED=true`. Even with a true build flag,
only eligible approved pages receive the controller, and each visitor still
needs the required consent. Preview, draft, sensitive-route, GPC/DNT, refusal,
and revocation protections remain in effect.

## Reading generated reports

The existing top-level booleans remain compatible. The shared `measurement`
metadata in the booking, analytics, and review-build reports makes their scopes
explicit:

| Report field | Interpretation |
| --- | --- |
| Booking/review `measurementEnabled` | Legacy booking collector only; remains false |
| `measurement.legacyBookingCollector.enabled` | Explicit legacy collector state |
| `measurement.consentControlledGa4.buildEnabled` | Whether the current build enables the consent-required GA4 integration; not visitor consent or delivery |
| Analytics `enabled` | Existing GA4 build gate; unchanged |
| Analytics `injected` / `finalPages` | Generated page inventory, not recorded visits |
| Analytics `finalVerified` / `finalVerifiedScope` | Generated HTML inventory, route eligibility, and page identities were checked; not collector or account receipt |
| `measurement.schedulingMetric` | Display name, source event, counting boundary, and diagnostic exclusions |
| `measurement.externalVerification` | External collector/account outcomes are not established by these build reports |

Production can correctly report the legacy flag as false and the GA4 build gate
as true. Neither value proves that a visitor consented or that a hit arrived.

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

This document defines website reporting semantics. It records no advertising
account change, external receipt, or appointment outcome.
