# Sonia Hassan biography and profile release

The owner supplied the complete approved biography, Care Philosophy, and Specialties directly on October 14, 2026 (America/Los_Angeles). `content/sonia-profile.json` preserves the nine supplied paragraphs verbatim, organized under About Sonia, My Approach, Working With Couples, Working With Teens, Working With Adults and Elder Adults, and Care Philosophy. All seven supplied specialties are included. The supplied self-reference is represented by the canonical profile URL rather than a redundant link back to the same page.

The registry, source evidence, displayed concerns, team listings, recommendations, related services, and scheduling route agree on `/sonia-hassan-bio`. Both forms of `/new-page-47` redirect there. Sonia's LSWAIC credential, seven described approaches (DBT skills, without a certification claim), original photograph, shared green hero, typography, and SimplePractice clinician ID `2065412` are retained. Other clinicians' biography prose is protected by regression hashes.

No provider settings, appointments, clinical records, DNS, indexing configuration, or unrelated biographies are part of this change.

## Review and release verification

Run `npm run check` and `npm run verify:publication`. The Sonia browser workflow verifies the 1440px and 390px candidate, links, consultation acknowledgment, portrait geometry, and one-tab scheduling destinations; its intercepted provider responses and emulated redirects are clearly labeled. The existing booking-handoff browser suite separately verifies actual SimplePractice navigation without selecting a slot or submitting client information.

Before the owner supplied replacement text, all three GitHub checks passed and desktop/mobile screenshots were visually inspected for the provisional candidate. The Netlify deploy preview built successfully but passive hosted requests returned HTTP 401. The new owner text resolves the previous biography-provenance blocker; the current commit's checks and screenshots must be reviewed before merge.

After the reviewed PR merges, Netlify publishes through the existing main-branch process. Verify the live page includes all approved paragraphs and specialties, both old addresses return 301, team and topic links target the canonical profile, and booking preserves Sonia's ID. The main-branch browser job uses the public site for actual handoff checks. No slot or client details may be submitted.
