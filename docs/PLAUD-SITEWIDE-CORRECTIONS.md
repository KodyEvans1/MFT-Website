# Plaud site-wide corrections

Basis: the raw October 2 Plaud transcript (of_981e34be515a342cd989fe0a5a8397c5) plus the owner's explicit follow-up that breadcrumb strips and unlinked topic lists persist across pages. This broadens the earlier one-page-only pass.

## Source-to-change record

- 00:31-01:00: remove top breadcrumb strips from every generated HTML page; retain structured hierarchy and useful parent links within page content.
- 01:02-01:28: all appointment/consultation actions retain supplied SimplePractice destinations. Repair the overlooked error-page header.
- 01:31-02:27: staff Ops stays in the footer; Marriage.Reset retains separate client access and top navigation.
- 02:27-03:24: keep separate consultation, appointment and benefits actions. Benefits/support opens email to support@mft.care; no message is sent automatically.
- 03:24-04:21: stronger dark green/old gold, visibly clickable topic cards, arrows, focus/hover states and usable touch targets.
- 04:23-05:22: clarify/review/schedule, native FAQ and support links; remove repeated old closing CTA and staff-oriented workflow language.
- 05:26-05:49: retain official logo and exact Marriage.Family.Therapy name, including on the error page.
- Current correction: 36 core bodies get topic-specific explanatory content and actual internal reading destinations instead of generic list grids. Contextual linking is bounded, never applied blindly to every word.

## Content boundary

36 bodies: six services, ten concerns, twelve approaches, three practical guides and five clinician profiles. Existing summaries and published-profile evidence supply their scope. Added copy is preparation and reading guidance, not new treatment efficacy claims, new certifications, prices or publication approval. Nine previously authored articles keep their exact words and review status. The large unreviewed expansion catalogue remains unfinished; links and styling are not a claim that all pages are substantive or launch-ready.

The explicit alias map links only existing targets. It avoids nested links, forms, citations, markup and self links; new production reading links exclude unapproved drafts. Clinician approach links require named-use evidence, not shared population tags.

## Build and verification

Core changes happen before protected-page fingerprints, with original templates snapshotted to prevent generic drafts inheriting unrelated rewrites. Existing publication validation checks the final hashes; no post-hoc checksum replacement hides changes.

The browser helper only handles valid same-page anchors and menu Escape. It does not collect information or send events. Anchors retain native hrefs, and destination focus is moved for keyboard users.

Run npm run check and npm run verify:publication. The added browser workflow checks 36 rewritten pages plus six shared-family examples at 1440/390 pixels and five pages at 320 pixels. It clicks service/topic/profile links, source references, FAQ and mobile navigation. Record any failures. These are static build-output checks, not live SimplePractice, hosted CSP, clinical review or full accessibility certification.

No main merge, domain/DNS change, Ads or Ops edit, appointment submission, tracking activation or content approval is authorized by this correction.
