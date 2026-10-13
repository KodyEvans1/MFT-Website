# Homepage-aligned service and retreat review

All eight service destinations use the homepage UI library. This change adds six
authored guides (couples, child, teen, family, premarital, retreat), retains the
Individual Therapy and Marriage.Reset compositions, and adds a native eight-option
Services directory. URL paths are preserved; no duplicate stock heroes are added.

Each guide contains a tailored explanation, examples, comparisons, steps, FAQs,
and relevant reading. Population-based clinician connections use existing profile
records. A couples connection does not establish a premarital credential, and no
retreat facilitator roster is inferred. Ages and availability are not invented.

Retreat prices of $1,250 (4 hours), $2,400 (full day), and $3,900 (overnight) remain
provisional planning figures, not final quotes. Dates, venue, staffing, lodging,
meals and inclusions are unconfirmed. No superior clinical outcomes, booking,
deposits, payments, or Offer/Event schema are asserted.

The format selector prepares a mailto link to support@mft.care. The visitor must
send the email themselves. No personal fields, network submission, storage or
analytics events are introduced. The default link works without JavaScript; the
visible support address is a fallback when no email app is configured. This is
not a deployed interest-list backend.

All new compositions are review-only. Clinical, visual and owner approvals remain
false. Production uses the existing release gate. No production branch merge,
DNS, Ops, advertising, measurement or patient-record change is authorized here.

Verification: npm run check; npm run verify:publication; node
tests/service-guides-browser.cjs. Browser checks cover the directory and eight
destinations at 1440/768/390/320, native navigation, keyboard disclosures, and
pricing-to-inquiry selection. No email or real appointment is submitted and no
hosted third-party iframe or actual availability is verified by these tests.
