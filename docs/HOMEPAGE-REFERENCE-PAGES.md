# Homepage-derived reference page system

## Scope

The owner rejected longer paragraphs with unrelated sidebar cards as insufficient.
This pass builds three reference pages at existing URLs: Individual Therapy
(`/new-page/`), Anxiety and Stress (`/anxiety-stress-therapy/`), and CBT
(`/cognitive-behavioral-therapy-cbt/`). No additional URL catalogue is generated.

## Shared building blocks

`src/ui/home-components.js` is used by the homepage AND all three page composers.
The hero, quick-action panel, question cards, numbered process, buttons and FAQs
come from the same renderers/classes. `src/assets/home-system.css` retains the
original homepage rules extracted from `enhance.js`, with extensions for story,
comparison, worked example, disclosure, clinician, source and jump-navigation
blocks. `content/homepage.json` preserves the homepage wording and sequence.

`src/reference-pages.js` composes each family from structured content rather than
adding prose to a common sidebar. The existing `site-experience` dispatcher selects
this composer instead of its legacy transformations for those three URLs. The
expansion engine freezes its source templates before dispatching finished pages;
a regression checks that new reference content cannot leak into generic drafts.
All other route families retain their existing implementation during migration.

## Content and interactions

Each page answers a different question with a different section sequence. Full
explanations stay visible; supplementary examples, techniques and FAQs use native
keyboard-operable details/summary. There are no response forms, diagnoses, quizzes,
new browser persistence, analytics collectors or AI-generated runtime answers.
Explicit related links connect individual care -> anxiety -> CBT -> clinicians.
Clinician cards use the maintained registry and exact published approach evidence,
with original portraits drawn from the existing profile. Profile use is not a
certification or a guarantee of availability.

Source records identify primary organizational references checked during writing.
Fictional teaching examples are labeled. Individual starting options preserve the
free 10-minute introduction and 53-minute clinical start; the focused private-pay
consultation is described without guessing its duration or fee. No clinical,
visual or owner approvals have been recorded.

## Publication boundary

New reference content is review-only. `CONTEXT=production` blocks it even when
indexing is off. An index-enabled policy rehearsal also uses the previous core
body, not these unapproved drafts. Promotion needs an explicit later review and
code change; this is not a complete publication UI. Existing SEO, privacy,
booking IDs, geographic relationships and original editorial drafts are preserved.

## Verification

`npm run check` runs core regressions plus reference-content checks.
`npm run verify:publication` rehearses preview/accidental-indexing/production rules.
`node tests/reference-browser.cjs` checks home and all three pages at four widths,
native disclosures/FAQ/example interactions, section/source focus, and the reading
path to a clinician's existing booking configuration. It does not submit a booking,
send email, activate measurement or claim hosted Netlify/SimplePractice validation.

Technical passing, visual acceptance, and substantive clinical/editorial approval
are separate milestones. More words, links or passing tests are not approval.
