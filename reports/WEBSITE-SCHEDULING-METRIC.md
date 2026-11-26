# Website scheduling measurement contract

## Current collection boundary — November 25, 2026

The website records qualifying scheduling handoffs only in the existing protected Ops receiver, after first-party consent. Google Analytics and advertising measurement are disabled. No Google tag runs on a care page or inside the former helper frame.

`content/google-measurement-policy.json` is the explicit, versioned Google eligibility record. Its status is `blocked-sensitive-context`, with no approved routes or events. Sitemap membership establishes publication eligibility, not permission to send information to Google. A true `GA4_BASIC_MEASUREMENT_ENABLED` flag cannot override this exclusion.

This is the release's engineering boundary under the owner's instructions. The unresolved issue is the intentional therapy-scheduling interaction combined with linkable advertising/browser identifiers. Removing names, coding a URL, or changing consent flags does not establish that this interaction is suitable for Google. The [November 25 exact-flow review](GOOGLE-MEASUREMENT-REVIEW-20261125.md) narrows the earlier assessment: Google’s personalization and enhanced-conversion restrictions do not categorically prohibit every ordinary conversion measurement feature. The separate GA4 sensitive-user-information restriction remains unresolved for this precise event and recipient-visible context. Preserve the [November 24 assessment](GOOGLE-MEASUREMENT-BOUNDARY-20261124.md) as historical evidence. No legal conclusion that every public healthcare-page visit is PHI is implied.

## The reported metric

Use **Website scheduling-link click** or **Scheduling handoff** for `simplepractice_exit`. It means a visitor intentionally activated an eligible new-client link to SimplePractice. Count that handoff once. Delivery is best effort and never delays native navigation.

| Action | Qualifying Ops handoffs, with applicable first-party consent |
| --- | ---: |
| Open a scheduling dialog | 0 |
| Read or check an acknowledgment | 0 |
| Cancel, close, click outside, or press Escape | 0 |
| Activate the enabled Continue to SimplePractice link | 1 |
| Repeated activation in the same dialog | 1 total |
| Existing-client sign-in | 0 |
| Returning visitor activates an eligible new-client link after remembered acknowledgment | 1 |

Analytics refusal, privacy signals, blocked storage, missing measurement APIs, or delivery failure do not disable scheduling. No measurement is replayed when consent is granted later.

The events `appointment_request_click`, `clinician_schedule_click`, and `consultation_click` remain diagnostic classifications. They are not added to the handoff total or sent to Google. There is no additional primary conversion event or alias.

A handoff does not establish a submitted request, an accepted or confirmed appointment, attendance, an acquired client, or revenue.

## Independent first-party delivery

1. `src/assets/mft-booking.js` retains the existing native destinations, dialog behavior, functional account acknowledgment and per-dialog deduplication.
2. It calls `MFTSchedulingMeasurement.track` without waiting for delivery.
3. `src/assets/mft-analytics.js` checks first-party consent, GPC/DNT and the fixed event/placement contract.
4. Only `simplepractice_exit` goes to `https://ops.mft.care/api/marketing/attribution`.

`OPS_HANDOFF_COLLECTION_ENABLED` is independent of Google. It still requires an eligible production/publication build and excludes previews, drafts, sensitive paths and pages containing forms. No new receiver, patient-data collection mechanism or persistent retry queue is introduced.

`MFT_BOOKING_CONFIG.measurementEnabled` remains false for the retired legacy collector. Compatibility helpers in `src/booking-core.js` do not activate that collector.

The former `mft-ga4-bootstrap.js`, `mft-ga4-frame.js` and helper HTML are inert compatibility assets. Former parent messages and direct asset loads do not initialize Google. The production CSP no longer permits Google collection or a same-origin analytics frame. A conditional replacement `mft-google-measurement.js` is present as an inert local asset. No page installs it while the eligible scope is empty. Its presence is not an active Google collection path.

## Conditional replacement — not activated

The candidate flow is recorded in `content/google-measurement-flow.json`. It covers only a generic scheduling handoff on `/` and `/about/`, with a fresh `mft.advertising.consent.v2` advertising-measurement choice. Earlier analytics grants and the former automatically denied advertising key cannot authorize it. No current production route or event is approved.

The build requires a documented exact-flow decision, matching SHA-256 fingerprints of the proposed flow and runtime, recorded network evidence, an eligible production context, and the explicit Google flag. Changing a flag, renaming the event, or changing the policy status alone cannot activate it. Build reports separately identify the candidate bytes and the actual installed Google inventory.

The booking bridge supplies only a local generic-handoff eligibility boolean to the first-party controller. Google receives neither the selected clinician/destination nor the Ops UUID or placement. Clinician-specific consultations remain excluded even when their diagnostic label is only `consultation_click` or the dialog’s Continue emits only `simplepractice_exit`. Existing native scheduling and Ops delivery are independent of that conditional Google decision.

If a later reviewed build activates this candidate, the new Google purpose uses its own consent-before-loader boundary. Refusal, withdrawal and GPC/DNT stop that path; the existing first-party purpose remains independently controlled. A fixed 30-minute advertising context must not become a rolling window. Actual vendor requests, cookie behavior, automatic metadata and native context continuity must be demonstrated, not inferred from configuration. The exact review document records their verified results and any remaining blockers.

The production sections below describe the currently blocked Google build. They do not claim the conditional candidate is approved, Google has received an event, or Ads has credited a conversion.

## Consent and withdrawal

| State | Purpose |
| --- | --- |
| `mft.analytics.consent.v5` | Browser permission for the narrower first-party Ops handoff measurement |
| `mft.analytics.consent.v4` in the POST envelope | Unchanged Ops receiver/data-scope contract; this is not the v5 browser-notice revision |
| `mft.advertising.consent.v1` | Separate advertising preference, forced to denied while advertising measurement is unavailable |

A valid v4 grant already covered the same first-party recipient and data scope, so it may migrate to v5. Earlier Google-only grants do not become first-party permission. Existing refusals remain effective.

New v5 grants are never written to v4/v3/v2: doing so could reactivate Google in an older, already-open document. Withdrawals propagate to those earlier keys. The advertising preference has no grant API while its purpose is unavailable; an injected or stale advertising grant cannot authorize collection.

The notice explains first-party measurement and the unavailable Google purpose. Closing it, acknowledging account information, activating Continue, and using existing-client sign-in do not grant analytics or advertising permission. The remembered account acknowledgment remains separate functional state.

Withdrawal aborts pending requests, invalidates queued retries, clears the source record, and removes recognized website-controlled legacy Google cookies. GPC/DNT overrides a stored grant, including when observed immediately before a pending retry. Cross-tab withdrawals are honored.

This does not claim deletion of data already received by a third party, remote replacement of JavaScript in an old open document, or removal of values from browser history or hosting logs.

## First-party handoff envelope

| Field | Contract |
| --- | --- |
| `schemaVersion` | `1` |
| `eventType` | `simplepractice_exit` only |
| `eventId` | Cryptographic random UUIDv4, generated once for the handoff |
| `occurredAt` | UTC action timestamp, ISO 8601 |
| `consentVersion` | `mft.analytics.consent.v4`, the unchanged receiving contract |
| `source`, `medium` | Existing enumerated pairs only |
| `campaignId` | Optional approved numeric campaign ID string, only for `google/cpc` |
| `pageCode` | Existing opaque 16-hex page code |
| `placement` | `header`, `footer`, `body`, or `dialog` |

Approved campaign IDs remain `24274542446`, `24362234053`, `24435101888`, `24444626634`, `24449945489`, `24530528782`, and `24524392745`. Ad-group and creative IDs are not admitted by this contract.

No visitor/session identifier, patient identity, contact detail, clinician ID, clinical information, form value, SimplePractice record ID, raw URL/referrer, search term, or raw Google click identifier is included. Neither the handoff UUID nor advertising identifiers are appended to SimplePractice destinations.

The POST omits credentials and referrers and uses keepalive. A transient failure may trigger one retry with the exact serialized envelope, UUID and UTC timestamp. Retry requires valid consent and a visible document. The existing receiver's unique event ID deduplicates repeated delivery; a receiver response establishes only event receipt.

## Identifiers, storage and expiry

| Item | Storage and lifetime | Withdrawal behavior |
| --- | --- | --- |
| First-party analytics choice | Browser local storage; preference only | Set denied; broadcast withdrawal to earlier supported keys |
| Advertising preference | Separate browser key; denied/unavailable | Remains denied; no raw advertising storage is created |
| Permitted source/medium and approved numeric campaign ID | `mft.analytics.source.v1` in session storage; 30 minutes from acquisition | Removed; late retries cannot reuse it |
| Internal handoff UUID | In-memory envelope for initial delivery and one bounded retry; existing Ops event store | Pending delivery aborted; existing Ops retention continues |
| Ops handoff record | Existing 30-day reporting period, with ingestion and authenticated daily cleanup | No new retention rule is introduced |
| Raw `gclid`, `gbraid`, `wbraid` values | No persistence or Google transmission by this measurement implementation | No new raw-identifier store exists |
| Recognized legacy Google cookies | No new cookies; root-path host-only and public-domain cookies are cleared | Cleared again on withdrawal |

The source classifier may recognize the presence/valid shape of a click marker to produce the internal label `google/cpc`. That label does not prove Ads attribution. Arbitrary query values and click identifiers are not retained. Internal navigation preserves the original source deadline; it cannot renew the acquisition period. An old document timer cannot delete a newer navigation's source.

The 90-day Ads conversion window does not authorize 90-day browser retention. Genuine advertising-identifier continuity and transmission have not been enabled in this release because the Google eligibility boundary remains unresolved.

## Protected request verification and attribution

| Reporting state | Required evidence |
| --- | --- |
| Website scheduling handoff | One qualifying recorded `simplepractice_exit` |
| Verified appointment request | Actual SimplePractice request verified by the existing protected Ops workflow |
| Attributed verified request | Verified request plus a demonstrated source connection |
| Accepted or confirmed appointment | Authoritative SimplePractice record explicitly establishing that state |

A request remains verified when its source is Unknown or Unmatched. A scheduled or billed appointment snapshot does not establish an earlier request, submission timestamp, or acceptance timestamp.

The website UUID identifies a delivery action, not a SimplePractice request. Names, clinician selection, appointment dates and temporal proximity are not matching evidence. A supported identifier connection must be demonstrated before use. No custom portal parameter, scraping match, invented callback or Google conversion export substitutes for that connection.

This website release does not alter Ops imports, protected identity links, request verification, or clinical records.

## Generated reports and release evidence

| Field | Meaning |
| --- | --- |
| `measurement.legacyBookingCollector.enabled` | Retired collector remains false |
| `measurement.firstPartyController.buildEnabled` | First-party controller installation gate |
| `measurement.consentControlledOps.buildEnabled` | Independent Ops destination gate; not receipt evidence |
| `measurement.consentControlledGa4.buildEnabled` | Effective Google state; false |
| `measurement.consentControlledGa4.requestedByEnvironment` | Requested flag, which cannot override the blocked policy |
| Analytics `enabled` | Google runtime only; false |
| Analytics `injected` / `finalPages` / `opsHandoffPages` | First-party page inventory, not Google traffic or events |
| Analytics `googlePages` | Google runtime inventory; empty |
| Analytics `allowedRoutes` / `allowedEvents` | Explicit Google eligibility; empty |
| Analytics `controllerAllowedRoutes` | Publication-eligible controller candidates, with sensitive/form exclusions |
| Release provenance | Exact source/deploy IDs, policy/asset hashes and separate Google/controller inventories |

Local tests, intercepted synthetic requests, production assets, internal receiver receipt, GA4 read-back and Ads-attributed conversions are different evidence. A callback, direct/organic label, synthetic click ID or configured action does not prove Ads credit.

Existing destination identities remain GA4 `G-BTK39BBNRE`, property `558962239`, stream `16124767332`, Ads account `420-172-2474`, and conversion `7911303814`. They are configured identities, not evidence that the disabled website path delivers events. No second primary conversion is created. The $10 maximum CPC ceiling, campaign budgets, targeting, and existing primary/secondary settings are preserved.

For this release, report **Google scheduling attribution disabled pending an event-and-route-specific data-boundary resolution**. Do not call it merely pending eligible traffic. That latter status applies only after an eligible implementation has actually been enabled and technically verified.
