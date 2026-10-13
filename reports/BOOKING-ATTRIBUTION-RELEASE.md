# Booking and website measurement release contract

## Scope

Use the five clinician widget configurations supplied by the practice owner and the practice-wide widget elsewhere. Keep existing-client portal, staff Operations, insurance inquiry, and Marriage.Reset actions separate. Keep M.F.T. button styling. A request-widget click is BOOKING_STARTED, never an appointment completion.

The widget snippets specify clinicians, not service codes, visit types, prices, or live availability. Check the actual SimplePractice schedule and appointment-request behavior before launch. Never submit a synthetic appointment to production as an automated test.

## Environments

This implementation belongs to the existing website review branch. Do not merge, change DNS, or enable production indexing based on passing CI alone. The separate Ops collector must be deployed and verified before website collection can be enabled.

Website measurement is off by default. SITE_MEASUREMENT_ENABLED=true only takes effect with explicit production context, the existing indexing release gate, and an actual mft.care origin. The matching Ops endpoint must independently have WEBSITE_MEASUREMENT_ENABLED=true in production. Do not enable either until privacy/security review, appropriate hosting arrangements, data retention/deletion procedures, abuse protections and real-account deployment verification are complete.

## Data contract

After an explicit visitor opt-in, send LANDING_VIEW once per tab/session and BOOKING_STARTED for scheduling-button clicks to the protected first-party collection design. Retain source through same-site browsing with a 30-minute inactivity boundary. Honor Global Privacy Control and Do Not Track. Refusing measurement never blocks scheduling.

Send only a random session/event identifier, enumerated source/medium, numeric campaign/ad group/creative IDs, optional network/device categories, and opaque page/button codes. Do not send patient names, email, phone, form values, diagnoses, raw URLs/referrers, raw ad click IDs, keyword text or clinician IDs to this collector. Do not send any of these events to Google. Codes/random identifiers are pseudonymous, not a claim of legal de-identification.

## Google Ads URL contract

The homepage can remain the ad destination. After the website release is approved, use the production homepage as Final URL and this Search campaign Final URL suffix without a leading question mark:

utm_source=google&utm_medium=cpc&utm_campaign_id={campaignid}&utm_adgroup_id={adgroupid}&utm_creative_id={creative}&utm_network={network}&utm_device={device}

Keep auto-tagging enabled. Do not overwrite an existing external tracking template without checking it. Review more-specific ad/keyword/sitelink options. Do not put health-related keywords or patient data in custom URL parameters. The /google/ pages remain optional noindex message-testing destinations, not proof of paid origin by themselves.

## Outcome boundary

These snippets do not establish an appointment-completion callback or join a browser session to a SimplePractice client record. The existing protected practice-report import remains separate. Do not attribute bookings, attendance, or revenue from a click, widget close, or a guessed identity match. No enhanced conversions, remarketing lists, or Google conversion export is activated here.
