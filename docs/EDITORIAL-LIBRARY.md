# Authored reading library - batch 1

Nine existing draft targets now have authored material: person-centered, strengths-based,
integrative therapy; repeated conflict, emotional distance, repair after conflict; first
therapy appointment, couples appointments, and online versus in-person couples care.
No new URLs are introduced by this batch. All remain draft/noindex.

## Ownership

`content/editorial-library.json` holds copy, sources, search intent and review receipts.
`content/clinician-evidence.json` records published profile descriptions and source dates.
Evidence of named use is not certification, independent credential validation, available
appointments, topic expertise or proof that a clinician reviewed an article. Multi-approach
profiles do not establish a separate integrative credential.

`src/editorial-library.js` validates/escapes content, renders the reading layout, and adds
reciprocal links to existing hubs and supported clinician profiles. `src/seo-expansion.js`
uses this renderer before generic draft generation. `src/editorial-check.js` independently
checks the built result through the normal site validator. Booking remains on the existing
SimplePractice configuration; the article does not collect answers or patient data.

## Review boundary

An article state must match its registry entry. Reviewed requires an editorial receipt;
approved requires editorial, clinical and owner receipts for the current SHA-256 revision.
Copy, sources and profile evidence enter that digest. Editing them invalidates earlier
receipts. The derived revisionHash field does not enter itself. No receipts are present
in this batch. Test reviewers are synthetic fixtures only and never written to content.

This is a repository-level integrity check, not an authenticated approval UI, a digital
signature, or a complete clinical review workflow. Authorized reviewers still must perform
the review and record genuine approvals. Existing publication, similarity, and environment
checks remain authoritative. Production discovery excludes unapproved batch articles.
Source checks and original preparation prompts are visibly separate from clinical review.

## Verification

- `npm run check`: build, output checks, Node regression tests.
- `npm run verify:publication`: three isolated policy builds, no deployment.
- `node tests/editorial-browser.cjs`: agent-browser against built output at 1440/390.
- `.github/workflows/editorial-browser.yml` installs pinned browser tooling and saves evidence.

The browser test checks all nine articles, section/source anchors, layout overflow, reading
hub -> article -> related article -> clinician navigation, and existing clinician booking
attributes. It does not open the SimplePractice widget, request an appointment, enable
measurement, or verify hosted Netlify CSP behavior. Live deployment remains separately gated.

The 650-page strategy, geographic graph, protected core pages, advertising configuration,
production domains and Operations app are unchanged. This batch improves nine drafts;
it is not nine newly approved or published pages.
