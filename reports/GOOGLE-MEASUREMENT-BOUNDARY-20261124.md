# Google scheduling measurement boundary — November 24, 2026

## Disposition

The requested advertising attribution of `simplepractice_exit` is **disabled**, not awaiting an eligible conversion. This release completes the independently safe first-party consent/runtime hardening under the owner's express instruction to disable a measurement path that cannot meet the sensitive-information boundary.

The existing event represents an intentional continuation toward therapy scheduling. Associating that interaction with advertising/browser identifiers can reveal care-seeking context. A generic event name, coded page URL, no patient name, and an advertising-consent grant do not establish that the combined information is nonsensitive.

This is a bounded engineering assessment. It is not a blanket claim that therapy practices cannot advertise, that all public healthcare-page visits are PHI, or that all pseudonymous identifiers are prohibited Google PII.

## Primary evidence

- [Google Analytics: HIPAA and Analytics](https://support.google.com/analytics/answer/13297105) prohibits collecting information that reveals sensitive information about a user, separately prohibits PHI, and states that Analytics offers no BAA. Its guidance calls for identifying eligible pages rather than treating public availability as sufficient.
- [HHS online-tracking guidance](https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/hipaa-online-tracking/index.html) includes the June 2024 partial-vacatur notice. A public health/provider-page visit plus IP address alone must not be described as automatically PHI. The guidance also distinguishes ordinary public browsing from information relating to identifiable care and explains that ordinary cookie banners are not HIPAA authorizations.
- [Google consent-mode reference](https://support.google.com/google-ads/answer/13802165) distinguishes advertising storage, advertising data use and personalization. Denied states can still permit cookieless requests; full URLs may still be collected. Denied flags alone do not prove that nothing was transmitted.
- [Google consent-mode overview](https://developers.google.com/tag-platform/security/concepts/consent-mode) describes basic blocking before consent, as distinct from loading Google under denied consent.
- [Google website-conversion guidance](https://support.google.com/google-ads/answer/7521212?hl=en) describes supported click context and cookie-based conversion processing. Following those mechanics does not establish that this therapy-scheduling signal is permitted.
- [Google enhanced measurement](https://support.google.com/analytics/answer/9216061?hl=en) covers automatic outbound, form, search, history and other interactions. Removing only the named scheduling event would not prevent equivalent automatic collection.
- [Google Ads customer-data policy](https://support.google.com/google-ads/answer/7475709?hl=en) restricts sensitive-category enhanced conversions and related customer-data features. Its stated scope must not be misrepresented as a universal ban on every ordinary healthcare conversion.

## Implemented independent protections

- Explicit Google route/event eligibility is empty and fails closed even when an environment flag requests Google measurement.
- The first-party Ops controller has an independent build gate. No Google runtime or helper is required for consented internal handoffs.
- Former Google assets are inert; the build removes Google CSP permissions and does not create another Google sender.
- Browser consent revision v5 is separate from the unchanged Ops receiver contract v4. The unavailable advertising purpose has its own denied preference key.
- Earlier refusals, GPC/DNT, withdrawal, source expiry, deduplication, native navigation, remembered account acknowledgment and mobile notice layout are preserved.
- No raw advertising identifier store, SimplePractice URL bridge, enhanced conversion or alternate Google scheduling event is introduced.

## Google account inspection

Read-only reporting and the signed-in Google interface verified the intended destination IDs, existing conversion action, primary/One/data-driven settings, 90-day click-through window, Google paid channels, GA4 once-per-event counting, the completed Ads link with personalized advertising disabled, outbound-click goals for seven campaigns and phone goals for zero campaigns. The connector verified auto-tagging and all seven $10 CPC ceilings. Budgets and targeting were not changed.

Google Signals was off. User-provided data collection was unavailable for the property's industry category. The stream's enhanced measurement was initially on; it was explicitly turned off to prevent automatic interactions bypassing the event exclusions. Standard page views can still exist when a Google tag runs, so this account setting does not replace the website's hard loading block.

No live test handoff, paid-ad click, appointment request, patient-data upload or second conversion action was created. Recent aggregate reports did not establish Ads credit; detailed account reporting is kept outside the public website repository.

## Missing evidence and smallest next action

The missing deliverable is an **event-and-route-specific assessment of the entire recipient-visible flow** that demonstrates how the intended therapy-scheduling attribution can comply with the required healthcare/sensitive-information boundary and Google's product rules.

That assessment must address the event's care-seeking meaning, account/site context, advertising/browser identifiers, normal network metadata, automatic collection, recipient processing and any legal obligations. It cannot be replaced by a generic deployment approval, a coded URL, a consent checkbox, an account with no warning, or a successful synthetic conversion.

Until that evidence supports a permitted implementation, keep this Google path off. A later implementation would need its own supported main-page runtime, explicit eligible scope, separate advertising permission, documented short retention and withdrawal behavior, intercepted-request verification, and naturally occurring Ads conversion-time credit against the existing action. Do not enable the retired frame or change only the environment flag.

## Release and rollback

Release through a reviewed source commit, required checks, main merge and a fresh Netlify production build. Verify the live provenance manifest's exact commit/deploy IDs and asset hashes; verify the notice and only nonconverting popup actions in production. Synthetic handoffs belong in isolated/intercepted tests.

Rollback should restore scheduling/UI behavior while retaining the Google exclusion and first-party separation. The prior `447f7de7968002960bdf2c105426b719f394d913` deployment contains the old Google helper, so blindly restoring it would also restore the unresolved path. Prefer a small forward fix or a rollback build that keeps Google disabled and the independent Ops gate. Keep GA4 enhanced measurement off; do not re-enable collection as an incidental rollback step.

Record final PR, merged commit, deploy ID and environment-specific test results in the release closeout after deployment. A successful build is not Ads attribution proof.
