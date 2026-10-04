# Marriage.Reset public explanation - owner-source implementation

## Source and scope

The owner supplied `Pasted markdown(1).md`, headed Marriage.Reset, on October 4,
2026. `content/marriage-reset.json` records its SHA-256, original section starting
lines, and cleaned paragraphs. The 21 source sections and eight FAQs are the
content basis; no general medical knowledge, validation claim, product feature,
price, module catalogue, or treatment outcome has been silently added. Truncated
internal handoff filenames and the source's design-direction sentence are not
rendered to visitors. Source text is organized, not replaced by new clinical copy.

## Public experience

- `/marriagereset/`: full model explanation, shared homepage hero/panels/cards,
  prominent dark-green five-stage journey, actual same-page navigation, focused
  assessment explanation, expandable depth, sequencing, modules, progress versus
  participation, adaptation/history, privacy/safety, human-care limits, eight
  source FAQs, and separate consultation and existing-client actions.
- `/marriage-reset-assessment/`: dedicated explanation of progressive assessment,
  question counts, separate partner voices, uncertainty, safety, recommendations,
  and how it connects to the continuing journey. Not an actual questionnaire.
- `/marriage-reset-assessment/thanks/`: compatibility information route only.
  It no longer claims a request was received or that an email is being sent.

The authoritative new copy explicitly rejects public self-enrollment. The old
Netlify form collecting two partner email addresses is removed from final build
output before deployment/form discovery in all build modes. Legacy free-assessment
link labels are replaced with assessment-explanation labels without changing URLs.
This does not remove historic submissions or forms from Netlify's account and does
not change the deployed Ops enrollment flow.

## Architecture and boundaries

`src/marriage-reset.js` reads the source record and composes the existing shared
homepage primitives. `src/reference-pages.js` delegates these three routes to the
native renderer, avoiding the generic interior-page rewrites. The detailed copy
is review-only, like the existing reference pages. Production rehearsals receive
only the source-supported invitation boundary, never the old public form.

The five-stage navigational composition and entry layout are the only new CSS
structures. Existing branding, portrait handling, the one-hero-image rule,
SimplePractice configuration, and source files for CBT and Anxiety are unchanged.
No new photos or diagrams are generated.

No public assessment, responses, partner email collection, progress scores, account
creation, invitation sending, purchase flow, or app feature is implemented here.
Client sign-in preserves the previously established Ops root; this work does not
verify authenticated account routing or the model's backend security/lifecycle
implementation. Main-page booking retains the supplied practice-wide configuration;
the assessment explanation keeps the existing no-widget/no-measurement boundary.
No production merge, DNS change, indexing activation, or tracking enablement.

## Checks

`npm run check` includes source fidelity, all 21 topics, all eight FAQs, numeric
qualifiers, lack of score/validation claims, route ownership, anchor integrity,
source coverage, booking/sign-in separation, and retired-form behavior. The
build itself runs `scripts/validate-marriage-reset.js`.

`node tests/marriage-reset-browser.cjs` uses agent-browser for three routes at
1440/768/390/320px, cycle links/focus, expandable cards, keyboard FAQ behavior,
actual page navigation, mobile menu navigation, no overflow, no duplicate heroes,
and no added input fields. It takes actual screenshots. No booking or app writes.
`npm run verify:publication` separately rehearses all three publication policies.
