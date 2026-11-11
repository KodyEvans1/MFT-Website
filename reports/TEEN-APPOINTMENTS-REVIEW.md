# Teen appointment pathway: implementation and release review

Website-only addition to draft PR #15 in KodyEvans1/MFT-Website. It preserves the prior care-design work, tracking PR #11 and Tri-Cities PR #14. No production merge or campaign activation is included.

## Source and preflight

The separately named MFT_Website_Build_Request_Teen_Counseling.md was not found in the available attachments/library. Work uses the complete requirements pasted by the owner. Main was inspected at 38b45d81a9403143057df46b856343bc69b7fa3d; the existing design candidate was f2fe4e0bf37ab7d4af0e397d63227124a7028e2b.

The source, booking registry, clinical content, current draft work, prior measurement work and public page were inspected. An initial web retrieval was cached and was not treated as a fresh-origin check. Subsequent direct HTTP reads in CI on November 10, 2026 Pacific time confirmed production still has the prior teen H1, prominent couples shortcuts and the clinical-review notice, and does not contain this new teen pathway marker. Production returned HTTP 200. This work did not change production.

## Implemented

- The existing /teen-counseling/ page now leads with Teen counseling. Space for your voice. and a native Request a Teen Appointment action.
- In-person Woodinville and eligible Washington telehealth descriptions are separate from appointment type. First clinical visits are explained as diagnostic evaluations, not consultations or ongoing therapy.
- Optional free 10-minute phone and paid 30-minute individual consultation choices are distinguished. The existing optional introduction acknowledgement is reused. Existing-client sign-in remains secondary.
- Couples shortcuts are removed only from this page's primary path. Other page content, shared booking configuration, clinician biographies and unrelated campaign work remain unchanged.
- Emily Johnsrud LMFTA, Gary Ashley LMHCA and Sonia Hassan LSWAIC retain their existing profile evidence, portraits and verified booking mappings. Numeric age bounds, openings and per-clinician insurance participation are not invented.
- The static builder now honors the same allowlisted explicit clinician mapping as the existing browser initializer. Native clinician links therefore remain correct before JavaScript runs.
- The original consent/confidentiality/caregiver/telehealth sections and clinical-publication review notice are preserved. Approval records remain pending.
- The top of the page explicitly tells visitors not to book an ongoing therapy session when a first evaluation is absent and provides a neutral support-email fallback. It does not fabricate a service parameter or send public appointment requests to Ops.

## Verified and discovered boundaries

The locally integrated implementation passed 296 tests and all three publication-policy rehearsals. A normalized comparison of 829 HTML files against the prior care-design candidate changed only teen-counseling/index.html apart from the source-derived shared CSS cache version.

For application candidate fd5e9c569503ef44ae10c23c75b91b8b2df7e28c, GitHub Website quality run 42947899444 and Marriage.Reset run 42947899482 passed. Artifact 13823637315 matched the locally tested source byte-for-byte. Teen acceptance run 42947899567 passed local HTTP layout/keyboard/consultation checks and four synthetic privacy conditions: declined consent, blocked analytics, GPC and JavaScript disabled. No Google requests were emitted in those synthetic cases. They are not GA4 receipt or real booking proof.

Hosted preview verification returned HTTP 401 Unauthorized. The preview protection was not disabled or bypassed. Netlify's successful preview build status is not proof of authenticated hosted behavior.

Independent real public scheduling checks in run 42948454290 reached the general clinician-search page and the correct Gary, Emily and Sonia service menus. Those observed menus showed Individual Therapy Session (53 Minutes), Initial 30 Paid Consultation and 10 min Complimentary Phone Consultation, but no identifiable diagnostic-evaluation label. This is a visible service-selection mismatch, not proof of the underlying billing-code configuration. Do not substitute the ongoing-session service. A mobile test in that run stopped because the scheduler's desktop heading is hidden on phones; the test now requires the heading to exist and the relevant clinician to be visible, without weakening destination checks. Current final evidence is recorded in the PR description and per-environment artifacts.

The verification script separates offline layout, local HTTP/synthetic privacy, built-candidate-to-real-SimplePractice handoffs, hosted-preview checks and fresh production inspection. It blocks non-read requests except the existing public next-slots query, never chooses an appointment slot, never enters client details and never submits a production appointment.

## Measurement and release

Scheduling-intent measurement remains disabled in the baseline. Existing basic analytics and privacy controls are unchanged. Measurement PR #11 remains on hold and unmerged. Clicks, submitted requests, accepted bookings and attendance remain separate; no downstream outcome integration is claimed.

The teen additions are preview-only until actual clinical, operational and publication evidence is entered against teen-appointments-v1 in content/teen-appointment-review.json. Practice review must establish teen age eligibility and teen-specific format support for the named clinicians and resolve the public first-evaluation selection mismatch. The clinical notice must be resolved through real approval, not removed to make the page appear finished.

Before production release, complete authorized hosted verification, regenerate tracked dist through the established release process, record the applicable content/publication approvals, and verify the deployed production page. The page is not yet cleared for teen-ad traffic. No advertising, Ops, payroll, tablet, account or SimplePractice configuration changes were made.
