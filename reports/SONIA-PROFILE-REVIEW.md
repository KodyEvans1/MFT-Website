# Sonia Hassan profile review candidate

Status: **Blocked for publication pending verification of intended replacement biography.**

The owner supplied `https://www.mft.care/sonia-hassan-bio`. A direct HTTPS request returned HTTP 404 on October 15, 2026 UTC (October 14 in Los Angeles). Neither saved material nor prior conversation retrieval supplied its missing text. Do not describe this candidate as the recovered or current owner-approved replacement.

The candidate paraphrases supported information from the former M.F.T. profile indexed at `https://www.mft.care/new-page-47`, and the repository's October 2 clinician evidence and existing education records. The indexed profile has fuller About Sonia and My Approach sections, lists teens, adults, older adults, and couples, and names ACT, CBT, DBT **skills**, Motivational Interviewing, mindfulness, narrative, and somatic approaches. Indexed content is historical evidence, not verification of the inaccessible replacement. No new certification, availability, pricing, or insurance claim is asserted.

## Candidate changes

- Use `/sonia-hassan-bio` as the canonical profile, matching the owner's supplied address and existing clinician biography convention. Both legacy path forms redirect with HTTP 301 to `/sonia-hassan-bio/`.
- Update registry, clinician recommendations, editorial profile references, related service links, portrait selectors, and biography education keys together. Retain the historical source URL in evidence metadata; rendered links use its canonical destination.
- Add About Sonia and My Approach inside the existing shared profile body. Keep the portrait source, green blend, geometry, typography, and shared booking controls. Other clinicians' biography prose is guarded by baseline hashes.
- Retain Sonia's SimplePractice ID `2065412`, native same-tab navigation, and practice-wide header/footer scheduling. Booking path matching supports both old and new profile addresses. No provider account settings or appointments change.

## Review and publication

1. Obtain the intended replacement text or a working authoritative reference from the owner. Compare it against `content/sonia-profile.json`, reconcile registry scope and approaches, and resolve the provenance blocker. Do not interpret an indexed old profile as the owner's new approval.
2. Run `npm run check` and `npm run verify:publication`. Review the draft PR and Netlify deploy preview at desktop and mobile sizes, including the real 301 responses and Sonia's SimplePractice handoff. Do not choose a slot or submit client information.
3. After content verification and review approval, merge through the existing GitHub/Netlify process. Verify the public canonical page, both legacy redirects, team/topic links, and same-tab scheduling. Do not publish this unresolved candidate.

The draft intentionally does not change production. A local browser test can establish candidate behavior; it cannot establish Netlify's hosted redirects or the live provider handoff.

## Validation evidence

- `npm run check`: 261 tests passed, zero failures; generated-page validators passed.
- `npm run verify:publication`: all three isolated preview/production policy rehearsals passed, 827 HTML files checked per rehearsal. Existing draft similarity warnings remain; no additional expansion pages were approved.
- Local Chromium execution was blocked because the browser was absent and the browser download returned an invalid archive. A PR browser workflow installs Chromium on GitHub Actions, tests desktop/mobile navigation and geometry, and uploads screenshots. Check its actual result before treating browser verification as complete.
- External scheduler responses in that candidate test are intercepted. Hosted Netlify redirects, real provider handoff, and visual review remain release requirements.
