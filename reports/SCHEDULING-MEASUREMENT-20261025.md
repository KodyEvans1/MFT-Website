# Scheduling measurement repair - 2026-10-25

## Purpose and authorization
Owner requested correcting public scheduling-button measurement and permitted paid-source attribution. This change does not change advertising budget, bids, service targeting, website design, booking destinations or actual clinical records. It is not a HIPAA/legal compliance certification.

## Observed gap
Previous GA4 integration counted a sanitized page view only and disabled the helper afterward. Booking navigation did not emit intent. GA4 reporting access is working, but click instrumentation and real booking reconciliation are different tasks.

## Implemented candidate
- Keep Google code in the inert empty HTTPS helper, not the care-page document.
- Explicit fresh v3 analytics choice for broader measurement; preserve old refusal, GPC and DNT.
- Optional appointment_request_click, clinician_schedule_click, consultation_click and simplepractice_exit. Never send clinician identifiers, booking URL, care text, form data, actual appointment details, user-provided text or raw advertising click IDs.
- Consultation opening is distinct from Continue; cancel sends no handoff. The subtype event and handoff are two descriptions of one action, not two conversions or two clients.
- The single recommended observational action is simplepractice_exit, labeled Scheduling started - NOT a booking. Do not import all four as summed acquisitions; do not make button clicks the primary clinical-client outcome.
- Allowlisted Google/paid source and known numeric campaign IDs can be recorded after consent. Raw gclid/gbraid/wbraid only contribute to local paid-source classification and are not stored or transmitted. This is not proof of Google Ads click-level or conversion attribution.
- Consented minimal source classification expires after 30 minutes in session storage and is erased on refusal.
- Booking navigation remains functional without analytics; a consented same-tab handoff has a bounded 300 ms fallback, independent of Google availability.
- Production origin/build approval boundaries, form/assessment exclusions and advertised destinations are retained.

## Verification
16 new VM tests cover consent, source scrubbing, expiry, opt out, event allowlists, trusted message boundary and duplicate guards. Full Node checks and publication rehearsals must pass for the exact candidate commit. Added a real-browser production-origin rehearsal using Google's real library with all Google collection and SimplePractice navigation intercepted. No test creates an appointment. A passed candidate rehearsal is not a deployed-page or GA4 dashboard receipt check.

## Release acceptance
Do not call this live until the deployed controller, frame and booking assets match the reviewed revision. Confirm a controlled generic test event reaches the intended measurement stream, distinguish collector acceptance from GA4 report receipt, and label/exclude tests in analysis. Do not generate a fake booking or send patient records.

## Separate outstanding administration / outcomes
- Verify the actual GA4-to-Google Ads link and create/import an appropriate secondary observational action only through supported admin capabilities, after event receipt verification.
- Remove calls from this Search campaign's primary goals without deleting history or affecting other campaigns, only with supported campaign-level controls and readback.
- Existing exposed campaign tooling does not document GA4 Admin writes or Search conversion-action/goal edits; do not guess parameters or claim these steps are saved.
- Actual requests, accepted bookings, attendance and revenue remain sourced from SimplePractice/Ops, reconciled with an approved identity bridge and kept outside advertising payloads. Unattributed outcomes remain unattributed. Finance fields retain separate authorization.
