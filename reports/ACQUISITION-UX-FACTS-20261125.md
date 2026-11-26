# Acquisition UX: verified facts and remaining limits

Request scope: the owner's November 25, 2026 focused website UX update, separate from the Google-attribution repair. Public scheduler observations below were made **November 26, 2026, approximately 05:36–05:40 UTC**. The filename follows the request date.

## Sources and use

The source order is: the owner's current instructions for prices and service distinctions; existing owner-approved clinician biographies and verified booking configuration; then the fresh public SimplePractice catalogue for current appointment formats and publicly offered service labels. A practicewide footer is not evidence of a particular clinician's format. No patient record, signed-in account, or internal scheduling configuration was accessed.

| Fact | Source | Website treatment |
| --- | --- | --- |
| Emily serves children ages 6+, teens, adults, couples, and families | `src/build.js`, Emily entry; `content/clinician-registry.json`; `content/clinician-evidence.json` | The acquisition introduction leads with individuals, ages 6+; the existing broader biography remains. Couples information is a separate secondary path. |
| Autumn serves children ages 6+, teens, young adults, and adults | Owner-approved `content/autumn-profile.json`; `content/clinician-registry.json` | The acquisition introduction remains individual. Family-support experience is not promoted into a couples-service claim. |
| Both clinicians have in-person Woodinville and telehealth choices | Fresh public catalogue and the service-specific location menus described below | Both formats appear beside each clinician's primary CTA. Appropriate format, service, and current appointment options still require confirmation. |
| Emily's current ad concerns individual telehealth | Owner's current UX instruction | Emily's introduction continues to lead with individual telehealth. |
| Telehealth eligibility requires physical presence in Washington | Existing approved Washington online-service and care-journey copy | The format sentence retains the Washington qualification. It does not make a blanket suitability claim for every client or service. |
| Clinician scheduler selection | `content/simplepractice-booking.json` and `src/booking-core.js` | Emily ID `2027366`, channel `professional_website`; Autumn ID `2183370`, channel `client_portal`. No service, location, time, or price is preselected. |

## Fresh public catalogue observations

The exact configured clinician URLs were opened directly. The workflow did not traverse an M.F.T. acquisition button, click a paid advertisement, or use any patient credentials.

**Public clinician list:**

<https://marriagefamilytherapy.clientsecure.me/request/clinician-search>

The live page listed six clinicians. Emily Johnsrud and Autumn Alexander each had the provider-specific labels **Woodinville, WA**, **Hybrid**, **In person**, and **Telehealth**. Search-tool snapshots differed in age and roster, so the current direct UI observation, not a cached search result, supports this update. No transient opening dates from the catalogue are used in the website copy.

**Observed clinician service-menu URLs after redirect:**

- Emily: <https://spwidget-marriagefamilytherapy.clientsecure.me/widget/service?appearance=%7B%22fullScreen%22%3Atrue%7D&channel=professional_website&clinicianId=2027366>
- Autumn: <https://spwidget-marriagefamilytherapy.clientsecure.me/widget/service?appearance=%7B%22fullScreen%22%3Atrue%7D&channel=client_portal&clinicianId=2183370>

Both direct menus displayed the same four service names and durations:

| Displayed service label | Displayed duration |
| --- | --- |
| Initial Session Diagnostic Evaluation (First appointment only) | 53 minutes |
| Individual Therapy Session (53 Minutes) | 53 minutes |
| Initial 30 Paid Consultation | 30 minutes |
| 10 min Complimentary Phone Consultation | 10 minutes |

For each clinician, the evaluation and paid short-consultation labels were selected only to inspect the next **location menu**. Both services offered **Telehealth** and **Marriage.Family.Therapy-Woodinville**, with the Woodinville address shown as 19151 144th Ave NE, L, Woodinville, WA 98072-4371.

The observed location URLs were:

- Emily: <https://spwidget-marriagefamilytherapy.clientsecure.me/widget/location?appearance=%7B%22fullScreen%22%3Atrue%7D&channel=professional_website&clinicianId=2027366>
- Autumn: <https://spwidget-marriagefamilytherapy.clientsecure.me/widget/location?appearance=%7B%22fullScreen%22%3Atrue%7D&channel=client_portal&clinicianId=2183370>

The selected service is not encoded in those location URLs; use the verified service menu and select the named service to reproduce that observation. No location was selected, no date/time menu was entered, no prescreener or contact information was supplied, and no appointment request or reservation was submitted. Both clinician tabs were returned to their service lists afterward.

## Price evidence and limits

Neither clinician's service menu nor the inspected location menus displayed a fee. The practicewide Services filter contained some rate-bearing variants, including short-consultation rate values 52.5, 55, and 67.5, diagnostic-evaluation variants 155 and 250, and several ongoing-individual-therapy variants. Those filter entries were not attributed to Emily or Autumn and do **not** establish either clinician's current fee. An ongoing-therapy rate is not the initial-evaluation price.

The website therefore uses the owner's expressly supplied baseline, recorded in `content/appointment-starting-costs.json`:

| Named option | Owner-supplied treatment |
| --- | --- |
| Complimentary introduction | 10 minutes; free; phone or virtual |
| Short consultation | 26-minute conversation, scheduled in a 30-minute block; $75 private pay |
| Separate one-hour couples consultation | $150 private pay |
| Initial individual evaluation | $150 private pay, or applicable insurance benefits; qualified by clinician, service, plan, and benefits |
| Reduced-cost couples/family program | Separate $150 program; not the universal ongoing couples/family-session fee |

The public 30-minute short-consultation label is compatible with the owner's 30-minute calendar-block explanation. It does not independently verify the 26-minute conversation length or $75 price. The one-hour couples option and separate reduced-cost program were not displayed in either inspected clinician's four-item service menu. The new catalogue explains those distinct owner-provided options without fabricating a preselected booking link, asserting universal availability, or claiming that the hour option replaces required couples preparation.

Current service availability and any exact per-clinician fee still require practice confirmation. The available public evidence does not support changing the owner's stated baseline to one of the unassigned filter variants. No SimplePractice catalogue or billing settings were modified.

## Routes and delivery boundaries

- The existing individual route `/new-page/` and couples route `/marriage-and-couples-therapy-counseling/` remain the Ads landing destinations.
- Emily's and Autumn's title, canonical URL, portrait, published credentials, education, and approved clinical biography remain intact.
- The individual evaluation is the primary clinician acquisition action; consultation is optional for individual care. Existing-client sign-in stays separate.
- The couples consultation, separate partner evaluations, and subsequent couples-session sequence remain distinct.
- Benefits checking starts with an email inquiry and proceeds through the practice's secure follow-up process. No public form collecting member numbers, birth dates, or clinical information is added.
- This UX work does not change campaign budgets, the $10 maximum CPC ceiling, Google collection eligibility, conversion actions, or the scheduling-handoff measurement contract.

The release owner records build, browser, deployment, and production-verification results separately. A published UX update is not evidence that Google attribution has become active.
