# Google measurement review — November 25, 2026 proposal

## Decision and scope

**Status: BLOCKED pending classification of the exact event and recipient-visible data.** This document defines a conditional proposal for review; it does not approve collection, activate a route, establish legal compliance, or report a successful attribution test. Primary sources were checked on November 26, 2026 UTC. Implementation and test results remain pending the release owner's evidence.

The proposal is limited to a generic new-client scheduling handoff from `https://www.mft.care/` or `https://www.mft.care/about/`, represented by the existing event name `simplepractice_exit`. Its meaning is an outbound navigation toward scheduling, not an appointment request submitted, appointment booked, treatment received, or financial outcome.

Google does not impose a blanket ban on every ordinary conversion measurement feature merely because the advertiser provides mental-health services. The specific unresolved restriction is Google's rule against Analytics data revealing sensitive information about a user, together with its prohibition on exposing protected health information (PHI). A scheduling-intent event associated with advertising/browser identifiers and the known practice can carry care-seeking meaning even without names or appointment details. The exact combination, rather than the event's spelling alone, requires classification. [G1][G2][G3]

Until that classification supports this exact flow, keep this Google event path blocked. A fresh advertising consent, successful request, neutral title, encoded route, or absence of a Google account warning is not a substitute for that determination.

## Exact conditional proposal

| Boundary | Proposed behavior, not an approved live implementation |
| --- | --- |
| Eligible routes | Only the canonical public paths `/` and `/about/`. No clinician, service, assessment, intake, registration, portal, payment, appointment, or internal operational route is eligible. |
| Eligible interaction | Only an actual activation of the generic new-client handoff to the approved SimplePractice scheduling destination. Exclude existing-client portal links, clinician-specific choices, scheduling-confirmation answers, proxy/minor questions, and any form interaction. |
| Scheduling event | `simplepractice_exit`, once per actual eligible handoff. Do not create aliases or additional scheduling conversions. |
| Page URL | The sanitized **actual eligible URL**, not a fictitious page or hashed substitute. Omit fragments and all query parameters except genuine click context that a documented Google attribution mechanism demonstrably needs after the new consent. Any exception must be enumerated and verified; it is not permission to forward the original query string. |
| Page context | A neutral, accurate site title such as `M.F.T. Public Website`; no actual page copy, heading, link text, sensitive title, or source-page label. No application-supplied or HTTP referrer to Google; suppression of both must be verified separately. |
| Permitted attribution identifiers | Only the native Google pseudonymous client, click, and session fields required by the selected supported mechanism, after fresh permission. Do not copy these into custom dimensions or create an identifier bridge to internal operations. |
| Explicit exclusions | No patient/contact data; clinician identity or selection; intake/account answers; appointment identifiers; outcomes; payment/refund data; internal Ops handoff ID; other custom user/transaction ID; SimplePractice destination URL; or form values. No invented monetary value. |
| Recipients | The Google Analytics service for the configured web property and the linked Google Ads account for the single reviewed conversion. No additional audience, remarketing, customer-data, or cross-domain destination is authorized. |
| Google features | Personalization, Google Signals, enhanced conversions, user-provided-data collection, enhanced measurement, remarketing, and audience exports remain off. No alternate automatic event may reconstruct excluded interactions. |
| Scheduling | Navigation remains native and independent of measurement success. Do not delay, require consent for, or otherwise condition access to scheduling on measurement. |

### Limited campaign coverage

This two-route proposal would cover only eligible handoffs actually occurring on `/` or `/about/`. Existing ads that land on clinician or location pages remain outside it. Enabling this proposal would therefore not automatically repair attribution for those campaigns, even if their budgets, links, and Google account settings are otherwise valid. Any route expansion needs its own event/context classification and request verification. This review recommends no ad-destination, targeting, bid, or budget change.

These boundaries minimize additional disclosure; they do not make the event anonymous. Google's contractual interpretation excludes pseudonymous advertising/cookie identifiers and IP addresses from its narrow PII definition, while explicitly recognizing that those data may remain personal information under privacy laws. The Analytics sensitive-information and PHI restrictions are independent. [G1][G4]

The actual outgoing request must be reviewed. Google documents automatic URL/title collection and browser metadata, including IP transport, user agent, referrer, and timestamps. Suppressing custom fields does not suppress all of those channels. Native automatic events such as `page_view`, `first_visit`, `session_start`, or `user_engagement` are not implicitly approved by this proposal: implementation tests must identify what the chosen library really emits and either prevent unapproved events or return the exact expanded flow for review. [G5][G6]

## Product rules and supported attribution mechanics

**Personalized advertising:** Google's health policy includes mental-health counseling and restricts advertiser-curated audiences. Its subject is targeting; it is not itself a universal prohibition on standard conversion measurement. [G2]

**Enhanced conversions/customer-data products:** Google's customer-data policy identifies its product scope, including enhanced conversions and store-sales uploads, and restricts sensitive-category measurement in those features. Health/medical information and some counseling conversions are listed. Those features remain excluded; their rules must not be generalized to all ordinary click-ID measurement. [G3]

**Analytics collection:** Google separately prohibits Analytics data revealing sensitive information about a user. For HIPAA-regulated entities it forbids exposure of PHI, even if outside Google's contractual PII definition, and states that Analytics offers no business associate agreement. Consent cannot override these product restrictions. [G1]

**Technical attribution:** For permissible data, Google documents GA4 key-event conversion import into Ads with a correct account link, auto-tagging, and preservation of the genuine GCLID. Dropping click context and retaining only a campaign/source label does not establish click-attributed conversion credit. The link's personalized-advertising option must remain off; Google documents that it defaults on. This document authorizes no link, import, or conversion-setting change. [G7][G8]

**Consent:** Any later eligible implementation requires a new, separate advertising-measurement choice. An earlier analytics choice must not be upgraded silently. `ad_storage` controls advertising storage; `ad_user_data` controls advertising data use, including measurement; `ad_personalization` can remain denied. Denied `ad_user_data` limits click-ID-keyed exports to Ads. Use blocking before consent for this path, not advanced-mode cookieless pings as a presumed no-disclosure substitute. Preserve withdrawal, earlier refusals, and the site's GPC/DNT behavior. [G6][G9]

Google says conversion tracking can continue under restricted data processing. That further distinguishes measurement from personalization, but does not permit prohibited information or establish compliance with Washington law. [G10]

The release owner's latest account readback reports property-wide advertising personalization off, linked-account personalization off, Google Signals off, enhanced measurement off, and `simplepractice_exit` designated non-personalized with once-per-event counting. These settings reduce uses or automatic collection; they do not resolve this event's classification. They are reported account evidence, not changes performed by the author of this document.

## Retention: three different controls

| Layer | Current evidence or proposed constraint | What cannot be claimed |
| --- | --- | --- |
| M.F.T. local source context | Preserve the existing fixed **30-minute** source expiry. Internal navigation and an already-open runtime must not refresh or bypass that deadline. | This deadline does not establish the lifetime of Google cookies or Google's stored data. |
| Browser cookies owned by Google measurement | Google documents `_gcl_` advertising cookies lasting **90 days** and default GA4 analytics cookies lasting **2 years**, with browser-specific limits. These defaults do not establish what the proposed configuration must or will write. Real-library interception is pending to verify the supported configuration, actual cookies, expiry, and update behavior. [G11][G12] | Do not describe advertising/vendor cookies as expiring in 30 minutes merely because the first-party context does. Do not assume an analytics-cookie override controls every advertising cookie, or that a 90-day cookie is unavoidable in this proposal. |
| Google server-side retention | The release owner's current account inspection reports event-data retention **2 months**, user-data retention **14 months**, and reset on new activity **ON**. This document does not change or independently re-inspect those settings. Google's guidance explains that reset can renew user-identifier retention and that the retention controls do not govern standard aggregate reports. [G13] | Do not represent account retention as 30 minutes, promise immediate historical deletion after withdrawal, or equate a cookie expiry with deletion of previously received data. |

Any external assessment must use these actual retention facts, including the unresolved cookie enforcement issue. If a shorter vendor lifetime is part of the accepted boundary, a documented configuration and real-library evidence must establish it before enabling collection. Withdrawal should stop future eligible sends and clear site-controlled state; it must not be described as retroactively deleting all Google-held data.

## Legal classification: limited questions, not assumptions

**HIPAA:** HHS prominently records the June 2024 partial vacatur of its guidance concerning an IP address associated with a visit to an unauthenticated public health/provider page. A public visit plus IP must not automatically be called PHI on that basis. The remaining guidance distinguishes ordinary public browsing from disclosures involving identifiable care, scheduling, registration, or health input. It also states that ordinary cookie banners are not HIPAA authorizations. This review does not establish M.F.T.'s covered-entity status or conclusively classify the proposed pre-scheduling event. [L1]

**Washington:** RCW 19.373 includes linkable information identifying a consumer seeking healthcare, including inferred associations; cookie, device, and IP identifiers can be personal information. If applicable, collection and sharing have distinct consent rules, subject to statutory exceptions. The law also contains information-specific exemptions, including HIPAA PHI and qualifying chapter 70.02 information. Do not assume that removing direct identifiers, using a public route, or being a healthcare practice resolves applicability. A determination that data is exempt from this statute would not itself make it acceptable to Google. [L2][L3][L4]

### One concrete external review question

For the practice's qualified privacy/legal reviewer, with Google product-policy support where needed:

> May M.F.T. transmit to Google Analytics and its linked Google Ads account a single `simplepractice_exit` event for a generic new-client scheduling-link activation on only `https://www.mft.care/` or `https://www.mft.care/about/`, accompanied only by the sanitized actual eligible URL, a neutral accurate title, necessary native Google pseudonymous client/click/session fields and unavoidable verified browser/network metadata, with no referrer, clinician selection, form/account answers, contact/patient data, SimplePractice destination URL, appointment/outcome/payment/refund data, or internal Ops ID; after a fresh optional advertising-measurement choice and with personalization, Signals, enhanced conversions/measurement and remarketing off; given fixed 30-minute M.F.T. local context, Google's documented 90-day advertising-cookie default unless a shorter supported setting is verified, and the inspected 2-month event / 14-month user retention with reset on new activity enabled—and specifically, does this complete flow reveal prohibited sensitive user information under Google's Analytics rule or constitute PHI/regulated care-seeking information, and what exact permissible payload, consent, recipient-use, or retention conditions would change that conclusion?

The response must identify the evaluated version and resolve the event's meaning in context. A generic instruction to “approve tracking,” a marketing/publication approval, or a successful synthetic event is insufficient. An assessment cannot authorize a violation of Google's independent terms.

## Practical alternative while the Google event remains blocked

Continue the independently authorized first-party Ops handoff measurement, with its own consent, minimization, source expiry, and access controls. Keep Ops records and identifiers inside that system. Separately use Google Ads' campaign-level aggregate reports for impressions, clicks, and cost, and compare trends over suitably broad periods in a private internal report.

This supports decisions about campaign traffic and overall handoff volume without uploading the handoff to Google. Do not join or export Ops IDs, individual timestamps, patient records, outcomes, or appointments to Google; do not create an offline conversion upload as a substitute. An aggregate comparison is observational: it does not establish which ad click caused a handoff, Google conversion credit, a completed appointment, or revenue. Neither report should manufacture those claims.

## Implementation and verification status

**Pending release-owner results.** This document records no code activation, approval, deployed test result, Google receipt, or Ads attribution. Before any later enablement, the release record must supply:

- The exact reviewed event classification and any conditions, plus the implemented route/payload/recipient boundary.
- Supported click-context and cookie configuration, verified expiry without extension, and accurate user-facing retention language.
- Intercepted real-library request evidence covering both eligible routes, all excluded routes, automatic events, consent absent/denied/withdrawn, earlier consent revisions, GPC/DNT, unexpected query input, metadata/referrer, and already-open expiry.
- Evidence that no excluded field or alternative event is transmitted, the generic handoff is counted once, and navigation remains available independently.
- Separate findings for Google receipt, GA4 key-event receipt, and any naturally occurring Google Ads conversion credit. None proves an appointment or clinical outcome.

Until those conditions are resolved, a clean build or account linkage must not be reported as permission to send this event. Preserve historical reports; record later implementation, deployment, and verification evidence in the new release record.

## Primary sources

- **[G1]** Google Analytics, [HIPAA and Google Analytics](https://support.google.com/analytics/answer/13297105?hl=en).
- **[G2]** Google Ads, [Health in personalized advertising](https://support.google.com/adspolicy/answer/16701855?hl=en).
- **[G3]** Google Ads, [Customer data policies](https://support.google.com/adspolicy/answer/7475709?hl=en).
- **[G4]** Google Analytics, [Understanding PII in Google's contracts and policies](https://support.google.com/analytics/answer/7686480).
- **[G5]** Google Analytics, [Best practices to avoid sending PII](https://support.google.com/analytics/answer/6366371?hl=en).
- **[G6]** Google for Developers, [Consent mode overview](https://developers.google.com/tag-platform/security/concepts/consent-mode).
- **[G7]** Google Ads, [Create conversions from Google Analytics events in Google Ads](https://support.google.com/google-ads/answer/2375435?hl=en).
- **[G8]** Google Analytics, [Connect Google Ads to Google Analytics](https://support.google.com/analytics/answer/9379420?hl=en).
- **[G9]** Google Ads, [Consent mode reference](https://support.google.com/google-ads/answer/13802165?hl=en).
- **[G10]** Google Ads, [Helping advertisers comply with U.S. states' privacy laws](https://support.google.com/google-ads/answer/9614122?hl=en).
- **[G11]** Google Privacy & Terms, [How Google uses cookies](https://policies.google.com/technologies/cookies?hl=en).
- **[G12]** Google Analytics, [GA4 cookie usage on websites](https://support.google.com/analytics/answer/11397207?hl=en).
- **[G13]** Google Analytics, [Data retention](https://support.google.com/analytics/answer/7667196?hl=en).
- **[L1]** U.S. HHS, [Use of Online Tracking Technologies by HIPAA Covered Entities and Business Associates](https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/hipaa-online-tracking/index.html), including the partial-vacatur notice.
- **[L2]** Washington Legislature, [RCW 19.373.010 — Definitions](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373.010).
- **[L3]** Washington Legislature, [RCW 19.373.030 — Collection or sharing of consumer health data](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373.030).
- **[L4]** Washington Legislature, [RCW 19.373.100 — Exemptions](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373.100).
