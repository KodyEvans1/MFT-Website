# By concern: shared design, substantive guides, and single-use heroes

## Owner direction
The October 4 review identified the old white two-column By concern list and repeated photographic heroes as inconsistent with the homepage/CBT design. This change replaces that hub with shared dark-green cards and connects nine independently authored concern guides alongside the unchanged Anxiety and Stress reference page.

## Implementation
- Native page composition reuses the homepage renderers. The concern hub is part of the native reference dispatch, not another post-generation layout rewrite.
- Concern guide bodies have independently authored explanations, fictional examples, expandable experiences, distinctions, support descriptions, questions, reading paths, and explicit recorded clinician focus-area relationships.
- No clinician match is invented for substance-use care. The absence of a recorded match remains visible, and medical withdrawal care is not presented as an ordinary counseling service.
- CBT and Anxiety source records are not rewritten. Both exact source hashes are tested.
- Solid deep-green feature sections and solid green cards alternate with lighter reading areas. No new stock images are generated or added.
- The hero-media policy assigns a photographic asset to one canonical page. Query-string resizing does not create another asset identity. The room photo remains on Contact/Office only; five personal profile heroes remain on their own biographies. Logos and informative clinician cards are separate from decorative hero reuse.
- Image removal runs before expansion templates and protected core fingerprints. A build-wide audit then fails on any repeated or unassigned hero asset. This is not a CSS-only hide.

## Review boundaries
Authored concern content and its native directory remain review-only. Existing routes, booking IDs, metadata canonicals, geography, protected publication checks and disabled preview measurement are preserved. No approval, production indexing, domain change, Ads change or Ops edit is included.

## Verification
Run `npm run check`, `npm run verify:publication`, and `node tests/concern-browser.cjs`. The browser workflow records actual mouse/keyboard interactions, screenshots, desktop/phone layouts and cross-page navigation, without submitting appointments or messages. Hosted Netlify authentication is separate; a successful build or local browser run does not establish authenticated hosted testing or clinical content approval.
