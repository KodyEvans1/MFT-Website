# Scheduling measurement repair - 2026-10-25

Owner requested public scheduling-button measurement and permitted paid-source attribution. Changes preserve campaign budgets/bids, website design, booking destinations and clinical records. This is not a HIPAA or legal compliance certification.

## Candidate behavior
Google runs only in an isolated empty document. Collection requires a fresh v3 choice; a prior refusal, GPC and DNT are respected. Intent event names are appointment_request_click, clinician_schedule_click, consultation_click and simplepractice_exit. No names, clinician identifiers, appointment details, form contents, full originating URL, search terms, or raw advertising click identifiers are forwarded.

One canonical scheduling-handoff signal is simplepractice_exit. Other events describe button context and must not be summed as additional acquisitions. Consultation cancellation is not a handoff. No click is a submitted request, accepted booking, attended client, or revenue.

After consent, acquisition includes allowlisted source/medium and the two known numeric campaign IDs. Raw gclid/gbraid/wbraid are used only to detect paid arrival locally, never persisted or transmitted. Session source expires after 30 minutes and is removed on refusal. This supports paid-source reporting, not proof of Google Ads click-level conversion attribution.

Google's helper stays active while analytics consent is granted; do not toggle its global opt-out between events because queued events can be dropped. Default automatic metadata remains sanitized and the helper has no forms, booking links or clinical page content. Denial disables and removes the helper. A same-tab scheduling action waits for the tag callback with a 2-second bound and independent 2.2-second fallback. Without consent or analytics, scheduling proceeds normally. Modified/new-tab clicks keep their native behavior.

## Verification
16 new VM tests complement the existing full suite. The new real-browser rehearsal uses Google's actual script, intercepts every collector request and SimplePractice navigation, and validates outgoing parameters, consent, destinations and counts without transmitting test activity to Google or creating appointments. Source/build success is distinct from browser success and from deployed-page/GA4 receipt verification.

## Separate outstanding work
The exposed tools do not document GA4 Admin writes or Search conversion-action/goal edits. Do not guess keys or claim those changes are applied. The appropriate observational action, once received and approved for import, is Scheduling started - NOT a booking, secondary. Keep actual requests, bookings, attendance and revenue in SimplePractice/Ops with an approved identity bridge; unmatched outcomes remain unattributed. No client data goes into advertising payloads. Finance permissions stay separate.

Do not call this live until deployment is matched to the candidate and a controlled browser event is verified. Collector acceptance is not the same as receipt in GA4 reports. Document and exclude any controlled tests from acquisition analysis. Calls-from-ads goal changes are pending a supported admin operation; history must be retained.
