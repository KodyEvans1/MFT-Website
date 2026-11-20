# New-client account confirmation — review draft

Status: proposed website wording and implementation for review. This document does not record clinical, legal, operational, or publication approval. The existing marketing approval concerns an earlier release and does not approve this new notice.

## Proposed public notice

### Before you request an appointment

Create an account only for yourself. Use your own name and contact information. Do not create an account or complete consent forms as another person.

For couples care, you may start a request if you will participate; each person completes their own account and consent steps.

**Children and help with signing up**

In Washington, adolescents ages 13–17 may request outpatient behavioral health care without parental consent.

If you are requesting care for a child or someone you legally represent, contact M.F.T. so we can confirm the appropriate consent and account setup. Do not create an account as that person.

If you feel pressured or unsafe, or need help with privacy, contact our office before using the portal.

[Call (425) 659-0654](tel:+14256590654) or [contact M.F.T.](https://www.mft.care/therapy-contact-woodinville/).

**Required checkbox**

> I am requesting care for myself, including couples care in which I will participate. I am responsible for the accuracy of the information I provide about myself and will complete only my own consent forms.

When possible, we’ll remember this acknowledgment in this browser. This is not consent to treatment.

Scheduling opens directly on SimplePractice in this tab.

Actions: **Continue to SimplePractice** · **Cancel**

## Why the proposed wording changes the requested exception

The Washington provisions reviewed do not establish a blanket “under duress” exception to portal identity or account creation. Treatment consent and account identity are different questions.

- [RCW 71.34.020](https://app.leg.wa.gov/RCW/default.aspx?cite=71.34.020) defines an adolescent as a minor age 13 or older; [RCW 71.34.530](https://app.leg.wa.gov/RCW/default.aspx?cite=71.34.530) permits adolescent outpatient self-consent and requires parental or legally authorized consent for children under 13.
- [RCW 71.34.650](https://app.leg.wa.gov/RCW/default.aspx?cite=71.34.650) provides a separate parent-initiated professional evaluation and treatment pathway. It is not permission to impersonate an adolescent in an online account. This draft does not assert that M.F.T. offers Family-Initiated Treatment.
- [RCW 70.02.265](https://app.leg.wa.gov/RCW/default.aspx?cite=70.02.265) places specific limits and requirements on adolescent treatment disclosures. Parent/guardian status does not automatically grant unrestricted portal or records access.
- [SimplePractice minor setup](https://support.simplepractice.com/hc/en-us/articles/360020093651-Adding-minor-clients) separates a minor’s identity and contact details from those of a parent or guardian. [Contact permissions](https://support.simplepractice.com/hc/en-us/articles/42001857971341-Managing-client-contacts) govern what an authorized contact can do. SimplePractice currently documents a required contact for minor profiles, so the clinic must verify its workflow for self-consenting adolescents without automatically inviting or disclosing to a parent.
- [SimplePractice couple profiles](https://support.simplepractice.com/hc/en-us/articles/360038903432-Creating-a-new-couple-client) retain individual identities within a couple. The draft therefore allows a participating partner to initiate a joint request while preserving each person’s own account and consent steps.

The office-assisted route accommodates requests concerning children, authorized representatives, and pressure/privacy concerns without treating a public checkbox as a legal determination. The notice does not establish identity, legal authority, treatment consent, financial liability, an accepted appointment, or suitability for any service.

## Interaction and persistence

| Scheduling action | First acknowledgment | Acknowledgment already remembered |
| --- | --- | --- |
| General evaluation or appointment request | Account notice | Native SimplePractice link |
| Clinician-specific request | Account notice; preserves clinician | Native link; preserves clinician |
| Paid individual or couples consultation | Account notice | Native SimplePractice link |
| Free 10-minute phone introduction | Account notice and existing consultation acknowledgment in one dialog | Existing consultation acknowledgment in the same dialog |
| Existing-client sign-in | Direct portal link | Direct portal link |

- The account preference is stored only on an enabled, trusted final Continue activation: `mft.newClientAccountAcknowledgment.v1 = acknowledged`.
- Only that fixed flag is stored. There is no name, age, clinician, timestamp, diagnosis, duress answer, or client identifier in the preference.
- “Once” means once for the same browser profile and site origin while that storage remains available. Clearing storage, private browsing, another browser/device, or a material acknowledgment-version change can show it again. If storage is blocked, an in-memory fallback lasts only for that page session; navigation remains available.
- Checking a box, opening, canceling, or pressing Escape does not save acknowledgment. The existing consultation acknowledgment remains transient.
- Native modal focus containment, Escape/Cancel, focus return, mobile scrolling, and one shared dialog avoid overlapping scheduling prompts. The analytics banner is temporarily hidden and made inert, including when it appears late, then restored without changing consent.
- Account acknowledgment does not grant analytics consent and is never sent as a GA4 event or parameter. Scheduling handoff measurement remains optional and cannot delay navigation.
- The final Continue remains a native anchor. Missing JavaScript, unsupported/failing dialog APIs, and context-menu/direct-link navigation can bypass the notice. This is an acknowledgment UX, not an access-control mechanism; SimplePractice and clinic procedures must enforce identity and consent requirements.
- The dialog markup is created at runtime so it does not add public intake fields or change the static analytics eligibility scan. Existing clinician destinations, scripts’ content-based cache versions, publication policy, and draft exclusions remain in place.

## Review before publication

1. Review the exact notice and acknowledgment, especially the adolescent self-request and representative wording.
2. Confirm that the listed office contact route can handle child/representative setup, privacy concerns, and self-consenting adolescents using the actual SimplePractice permissions workflow.
3. If M.F.T. intends to offer Family-Initiated Treatment, separately confirm the clinical admission and evaluation process before making any public FIT promise.

The requested deliverable is a draft. Keep this change in review until the new wording and workflow are accepted; do not reuse the earlier marketing approval as evidence of that acceptance.

## Verification

Completed locally:

- `npm run check`: 339 Node regressions passed; site validation reported no errors.
- `npm run verify:publication`: the default preview, accidentally enabled preview, and production policy rehearsals passed. Both previews retained zero sitemap URLs; production retained 63; all 757 generated expansion pages remained unapproved drafts.
- Independent source review confirmed the native-link, consent separation, and approval boundaries and identified the mobile-menu Escape conflict, which was corrected.
- The existing marketing revision remains `a0384330504791dd1d536059871befc45672776d2a24df8acee4ef4c231a1c36` and remains approved for its existing scope.
- Changed Python fixtures and workflow YAML parse; `git diff --check` passes.

Local browser execution could not begin because this environment denied Chromium’s process-singleton socket. Zero browser checks ran in that attempt. The dedicated account-confirmation workflow and existing scheduling-measurement workflow will execute the behavioral and actual-library privacy/navigation checks on hosted runners. The focused workflow also asserts the exact 63-sitemap / 60-analytics-page / 757-draft baseline.

No appointment or patient account is created by these checks. Synthetic browser checks intercept scheduler and analytics traffic and deny browser DNS egress.
