# Autumn Alexander addition and Taylor Nolan scope correction

Scope: KodyEvans1/MFT-Website only, based on main 38b45d81a9403143057df46b856343bc69b7fa3d. The owner supplied Autumn's portrait and complete biography, requested adding her to the public website, and explicitly stated that Taylor is not a play therapist and does not work with children. These instructions approve this scoped profile content, not the separate care/teen design release in PR #15, measurement PR #11 or Tri-Cities PR #14.

## Implemented

Autumn uses the existing clinician profile, logo, typography and portrait presentation. The source of truth is content/autumn-profile.json. All five supplied concern descriptions, four approaches, seven focus areas, education and training are preserved with consistent spelling/punctuation. Children age 6+, teens, young adults and adults are explicit. Experience supporting families is not silently promoted into a family/couples service or certification. Crisis support is clearly distinguished from an emergency/on-call service.

The owner-uploaded portrait is self-hosted as a metadata-free, 576 x 1023 WebP; its source and output checksums are recorded. No generative retouching or replacement photo was used. Homepage and team cards include Autumn, with a balanced six-person grid, and relevant child/teen/individual service cards carry the age-6+ limit.

No verified Autumn SimplePractice clinician ID was available in the website configuration. Her primary action therefore contacts the practice about appointments. No ID, appointment opening, clinician-specific format, insurer participation, or scheduler parameter was invented. Existing five clinician mappings are preserved.

Taylor's registry/evidence already describe adult work. Her profile now states the adult scope explicitly. Unsupported child/teen and play-therapy recommendations are excluded by scope checks and regression tests. The existing biography, credentials, photo and clinicianId=2031820 mapping remain otherwise intact. The reviewed Taylor prose snapshot changes only for the new adult-scope sentence.

## Verification

Local build and 286 tests pass; all three isolated publication-policy rehearsals pass. Existing preview/noindex protections, analytics consent code and booking configuration remain unchanged. The previous 251 draft catalogue warnings remain unrelated and are not approved by this change.

The local runtime blocks HTTP browser navigation to localhost (ERR_BLOCKED_BY_ADMINISTRATOR). Six offline views of the actual generated profile/team HTML, with its CSS and local assets embedded, passed overflow checks at 1440 and 390 pixels. Autumn's source photo loaded at its actual intrinsic dimensions. This is visual inspection only, not hosted navigation or JavaScript verification.

A repository browser test runs the actual generated files over local HTTP in CI, using installed Chrome, with external requests blocked. It checks 20 route/viewport combinations, native links, keyboard focus/menu behavior and JavaScript-disabled fallback. Public-page inspection is separate, read-only, and records response codes/hashes without submitting appointments or email. Exact CI and deployment outcomes belong in the PR closeout, not inferred from local success.

## Boundaries

No appointment, public form, email, advertisement, campaign, budget, Ops, payroll, Android/tablet, employee account or clinical record is changed. The prior draft PRs remain untouched. No broad clinical/article review approval is fabricated. Autumn's appointment setup is a separate operational follow-up; the profile remains useful through the contact-practice action.
