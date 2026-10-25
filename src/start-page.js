'use strict';
// October 2 Plaud visual audit: apply the named first-page redesign without
// changing clinical policies, the shared footer, or other page-family layouts.
const SCHEDULE = 'https://marriagefamilytherapy.clientsecure.me/';
const BENEFITS = 'mailto:support@mft.care?subject=Benefits%20verification';
const QUESTION = 'mailto:support@mft.care?subject=Website%20question';
const MR_ACCESS = 'https://ops.mft.care/';

function startMain() {
  return `<main id="main" class="start-guide" data-scheduling-journey="20261025" data-plaud-review="2026-10-02">
  <section class="start-hero" aria-labelledby="start-heading">
    <div class="start-intro">
      <p class="kicker">Marriage.Family.Therapy</p>
      <h1 id="start-heading">Your path into care.</h1>
      <p class="start-lead">Know what to schedule, what each appointment is for, and what happens next. Individual care and couples care have different starting paths.</p>
      <nav class="journey-jump" aria-label="Choose your care journey"><a href="#individual-journey">Individual care</a><a href="#couples-journey">Couples care</a><a href="#consultation-call">Your 10-minute call</a></nav>
      <a class="start-text-link" href="#start-steps">How to request an appointment <span aria-hidden="true">&darr;</span></a>
    </div>
    <aside class="start-options" id="appointment-options" aria-labelledby="start-options-heading">
      <p class="kicker">Choose where to begin</p><h2 id="start-options-heading">A conversation, or your first appointment.</h2>
      <a class="start-button start-button-gold" href="${SCHEDULE}">Free 10-minute phone consultation <span aria-hidden="true">&rarr;</span></a>
      <a class="start-button start-button-outline" href="${SCHEDULE}">Request an appointment <span aria-hidden="true">&rarr;</span></a>
      <p class="start-helper">Both buttons open SimplePractice. Choose the appointment type there; a request is not a confirmed appointment. For couples, choose the 30-minute couples consultation before evaluations or ongoing sessions.</p>
      <div class="start-benefits"><h3>Have a benefits question first?</h3><a class="start-button start-button-outline" href="${BENEFITS}">Verify benefits <span aria-hidden="true">&nearr;</span></a><p class="start-helper">Opens your email app to contact support@mft.care. Please leave insurance numbers and clinical details out of the initial email.</p></div>
    </aside>
  </section>
  <section class="start-section" id="individual-journey" aria-labelledby="individual-journey-heading">
    <div class="start-section-heading"><p class="kicker">For individual clients</p><h2 id="individual-journey-heading">You can begin directly with your evaluation.</h2><p>Neither consultation is required for individual care. Choose an optional conversation first, or go straight to the diagnostic evaluation (90791).</p></div>
    <ol class="start-step-grid journey-grid">
      <li><span class="journey-stage">Optional</span><h3>Talk before you begin</h3><p>A free 10-minute phone consultation offers a brief introduction. A paid 30-minute individual consultation gives you more time to discuss fit, questions, and the care process. Choose either, both, or neither.</p></li>
      <li><span class="journey-stage">First clinical appointment</span><h3>Diagnostic evaluation (90791)</h3><p>Your clinician gathers information about your concerns, relevant history, needs, and goals. The evaluation helps clarify what is happening and provides the foundation for your treatment plan.</p></li>
      <li><span class="journey-stage">Your ongoing care</span><h3>A measurable treatment plan</h3><p>Together, identify clear goals, an evidence-based approach suited to your needs, and how progress will be measured. Revisit the plan as you work, so appointments remain purposeful and responsive to your goals.</p></li>
    </ol>
    <div class="journey-actions"><a class="start-button start-button-green" href="${SCHEDULE}">Request a diagnostic evaluation <span aria-hidden="true">&rarr;</span></a><a class="start-button start-button-outline" href="${SCHEDULE}">Request a paid 30-minute individual consultation <span aria-hidden="true">&rarr;</span></a></div>
  </section>
  <section class="start-section journey-couples" id="couples-journey" aria-labelledby="couples-journey-heading">
    <div class="start-section-heading"><p class="kicker">For couples</p><h2 id="couples-journey-heading">Start together. Understand each person. Return together.</h2><p>All couples begin with a 30-minute couples consultation. You may have an optional free 10-minute phone consultation before it, but the phone call does not replace the required 30-minute consultation.</p></div>
    <ol class="start-step-grid journey-grid">
      <li><span class="journey-stage">01 &middot; Required first step</span><h3>30-minute couples consultation</h3><p>Meet with your couples therapist to discuss what brings you in, begin aligning goals, and agree on the rhythm and frequency of care. This is a paid consultation, separate from ongoing couples sessions.</p></li>
      <li><span class="journey-stage">02 &middot; Each partner separately</span><h3>One diagnostic evaluation per partner</h3><p>Each partner has a separate, one-time diagnostic evaluation with the couples therapist. These appointments gather each person&rsquo;s history, concerns, and perspective to help build a treatment plan that reflects both partners&rsquo; goals.</p></li>
      <li><span class="journey-stage">03 &middot; Back together</span><h3>53-minute couples sessions</h3><p>After both partner evaluations, return together for couples sessions. Work from a shared, measurable treatment plan, using an evidence-based approach suited to your presenting concerns and reviewing progress along the way.</p></li>
    </ol>
    <aside class="journey-note" aria-labelledby="couples-role-heading"><h3 id="couples-role-heading">A couples therapist, not your ongoing individual therapist.</h3><p>The separate diagnostic evaluations are part of the couples assessment. They do not establish ongoing individual therapy with your couples therapist. If you also need individual therapy, that care is with a separate individual therapist.</p><p>Discuss privacy, records, and how information from the individual evaluations is handled with your couples therapist before those appointments. The practice&rsquo;s disclosure and consent process governs those arrangements.</p></aside>
    <div class="journey-actions"><a class="start-button start-button-green" href="${SCHEDULE}">Request a 30-minute couples consultation <span aria-hidden="true">&rarr;</span></a></div>
    <p class="start-helper">Couples consultations and couples sessions are private pay. Confirm the fees and any applicable coverage for diagnostic evaluations separately; this pathway does not establish insurance eligibility.</p>
  </section>
  <section class="start-section" id="consultation-call" aria-labelledby="consultation-call-heading">
    <div class="start-section-heading"><p class="kicker">Available to all clients</p><h2 id="consultation-call-heading">What to expect from your 10-minute consultation.</h2><p>This optional, free introduction is available to individual clients and couples. It is not a diagnostic evaluation or a therapy session. The calendar may reserve 15 minutes, but the consultation lasts 10 minutes.</p></div>
    <div class="journey-call-grid">
      <article><h3>Usually a phone call</h3><p>These consultations are usually by phone. Occasionally, one is arranged through telehealth and you can join virtually using the access instructions provided for your appointment.</p></article>
      <article><h3>Phone is the immediate fallback</h3><p>If the technology does not work immediately, the consultation will be a phone call instead. Keep your phone available and make sure your contact number in SimplePractice is current.</p></article>
      <article><h3>Expect a practice or hidden number</h3><p>The call may display Marriage.Family.Therapy, or it may arrive from a hidden, private, or unknown number. Be ready to answer at your scheduled time.</p></article>
    </div>
    <p class="start-helper">The phone fallback described here applies to the 10-minute consultation. Confirm the format and any interruption plan for clinical appointments with your clinician.</p>
  </section>
  <section class="start-section" id="start-steps" aria-labelledby="start-steps-heading">
    <div class="start-section-heading"><p class="kicker">Requesting your appointment</p><h2 id="start-steps-heading">Three practical steps to schedule.</h2></div>
    <ol class="start-step-grid">
      <li><span class="start-number" aria-hidden="true">01</span><h3>Clarify what you are looking for</h3><p>Choose individual or couples care using the paths above. You do not have to choose a therapy approach before contacting us.</p><a class="start-button start-button-green" href="/services/">Explore services <span aria-hidden="true">&rarr;</span></a></li>
      <li><span class="start-number" aria-hidden="true">02</span><h3>Review clinician information</h3><p>Read the profiles and compare who each clinician works with, their focus areas, and their approach.</p><a class="start-button start-button-green" href="/team/">Meet the team <span aria-hidden="true">&rarr;</span></a></li>
      <li><span class="start-number" aria-hidden="true">03</span><h3>Schedule</h3><p>In SimplePractice, choose the clinician, appointment type, and available time. Follow the confirmation and preparation instructions you receive. If the right appointment type is not listed, ask support before choosing a different service.</p><a class="start-button start-button-green" href="${SCHEDULE}">Schedule in SimplePractice <span aria-hidden="true">&rarr;</span></a></li>
    </ol>
  </section>
  <section class="start-section start-faq-section" id="start-questions" aria-labelledby="start-faq-heading">
    <div class="start-section-heading"><p class="kicker">Common questions</p><h2 id="start-faq-heading">A few practical answers.</h2><p>Need help finding the right place to go? Start here.</p></div>
    <div class="start-faq">
      <details><summary>Where do I request a consultation or appointment?</summary><p>The consultation and appointment buttons open our SimplePractice scheduling options in the same tab. Choose the appointment type and clinician there. Appointment requests are not confirmations. If the correct appointment type is not available, contact support rather than selecting a different service.</p></details>
      <details><summary>How do I ask about insurance benefits?</summary><p>Use the Verify benefits button to open an email to support@mft.care. Ask the support team how to begin a benefits check without including insurance numbers or clinical details in that initial message. A consultation or diagnostic evaluation does not guarantee insurance coverage.</p></details>
      <details><summary>Where do existing clients sign in?</summary><p>Use the <a href="${SCHEDULE}">existing client portal</a> for SimplePractice. The staff Operations link in the footer is separate from ordinary appointment scheduling.</p></details>
      <details><summary>Where can I find Marriage.Reset?</summary><p>Choose <a href="/marriagereset/">Marriage.Reset</a> in the top navigation. That page includes a separate sign-in link for Marriage.Reset clients.</p></details>
    </div>
    <div class="start-support"><div><h3>Have a different question?</h3><p>Contact the support team about the practice or how to get started.</p></div><a class="start-button start-button-green" href="${QUESTION}">Ask support a question <span aria-hidden="true">&nearr;</span></a></div>
  </section>
</main>`;
}

function addJourneyLinks(html) {
  // Shared discovery, before booking decoration and protected-page fingerprints.
  let out=html.replace(/<nav\b[^>]*class="primary-nav"[^>]*>[\s\S]*?<\/nav>/,nav=>nav.includes('href="/how-to-start-therapy/"')?nav:nav.replace('<a href="/services/">','<a href="/how-to-start-therapy/">How to start</a><a href="/services/">'));
  out=out.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/,foot=>foot.includes('href="/how-to-start-therapy/"')?foot:foot.replace('<h2>Start here</h2><p>','<h2>Start here</h2><p><a href="/how-to-start-therapy/">How scheduling works</a><br>'));
  return out;
}

function applyPlaudEdits(html, route) {
  if (route === '/how-to-start-therapy/') {
    if (!/<main\b[^>]*>[\s\S]*?<\/main>/.test(html)) throw new Error('Starting-care page is missing its main region');
    // Replace the complete old body: no breadcrumbs or repeated generic CTA survive.
    return html.replace(/<main\b[^>]*>[\s\S]*?<\/main>/, startMain());
  }
  if (route === '/') {
    // Keep the already-established homepage; remove only the redundant closing CTA.
    return html.replace(/<section class="section final-cta reveal">[\s\S]*?<\/section>/, '');
  }
  if (route === '/marriagereset/' && !html.includes('data-mr-client-access')) {
    const anchor = '<a class="button dark" href="/marriage-reset-assessment/">Start the free Marriage.Reset assessment</a>';
    if (!html.includes(anchor)) throw new Error('Marriage.Reset access placement changed; inspect before editing');
    return html.replace(anchor, anchor + `<div class="mr-client-access"><p>Already using Marriage.Reset?</p><a class="start-button start-button-outline" data-mr-client-access href="${MR_ACCESS}">Marriage.Reset client sign-in <span aria-hidden="true">&rarr;</span></a></div>`);
  }
  return html;
}
module.exports = { applyPlaudEdits, startMain, addJourneyLinks, SCHEDULE, BENEFITS, QUESTION, MR_ACCESS };
