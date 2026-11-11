# M.F.T. care-pathways design review

Owner requested distinctive, branded, cohesive service pages without redundant copy. This branch is a review build, not a production publication.

Base: 38b45d81a9403143057df46b856343bc69b7fa3d (main).

## Scope

Services comparison hub; differentiated child, teen, adult individual, couples and family page compositions; new individual-therapy-with-support-person guide. Adult and individual use one existing canonical route rather than competing duplicate pages. Existing source-backed educational sections, clinician evidence, appointment pathways, privacy and analytics boundaries are retained. Small comparison links connect the homepage and How to Start to the services hub. New conjoint route remains noindex and outside the sitemap pending publication review.

Design uses the existing logo, teal, cream, sage and gold, serif headlines, shared spacing and controls. Distinct compositions include child growth forms, teen-first dark theme and caregiver note, adult reflective prompts, couples sequence, family relationship circles, and conjoint focus/support illustration. Small gold-on-light labels have a darker accessible foreground. No new external image assets or fonts.

## Verification

The final source integration was built and tested locally on November 10, 2026 (Pacific time):
- npm run check: 285 tests passed, zero failed. Baseline was 278; seven targeted care tests were added.
- npm run verify:publication: all three isolated publication rehearsals passed, including accidental indexing enable on a preview and production policy rehearsal.
- 829 HTML files validated, no validation errors. 251 pre-existing draft catalogue warnings remain; baseline also has 251. This work does not approve the generated SEO catalogue.
- 28 offline Chromium layout checks: seven care pages at 1440, 768, 390 and 320 pixels; one H1/main, no horizontal overflow, logo loaded, measurement disabled, correct existing-client sign-in links, zero script errors.
- FAQ mouse/keyboard operation and mobile menus passed. Desktop and phone screenshots inspected; local link/fragment tests resolve all care-page destinations.

Initial CI failed because the isolated build-wrapper test stubs did not contain a newly added stage. Final integration now composes care inside the existing preparation step before booking decoration and stylesheet fingerprints; build wrapper and its safety test remain unchanged from main. No safety assertions were removed.

## Limits / release state

Browser navigation to the local HTTP server is blocked by the runtime administrator. Visual testing used the actual generated HTML with local CSS, scripts and logo inlined in Chromium; all external requests were blocked. This validates offline layout and controls, not a live hosted browser journey, remote clinician photographs, appointment submission, clinician availability or real account authentication. Existing external clinician imagery and public booking destinations are unchanged.

No production merge or deployment. Generated dist is created by the normal build and supplied as a separate review package; tracked production dist has not been refreshed in this source-only design PR. Before release, approve the design/content, regenerate tracked dist per the repository workflow, decide publication/indexing of the new conjoint route, and verify the hosted preview and native scheduler navigation. Do not change global publication flags or include unrelated PRs.

No changes to Ops, databases, payroll, advertising, tracking PR #11, Tri-Cities PR #14, SimplePractice configuration, appointment submissions, client accounts or clinician biographies. No clinical or owner publication signoff is manufactured.
