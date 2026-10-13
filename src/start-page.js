'use strict';
// October 2 Plaud visual audit: apply the named first-page redesign without
// changing clinical policies, the shared footer, or other page-family layouts.
const SCHEDULE = 'https://marriagefamilytherapy.clientsecure.me/';
const BENEFITS = 'mailto:support@mft.care?subject=Benefits%20verification';
const QUESTION = 'mailto:support@mft.care?subject=Website%20question';
const MR_ACCESS = 'https://ops.mft.care/';

function startMain() {
  return `<main id="main" class="start-guide" data-plaud-review="2026-10-02">
  <section class="start-hero" aria-labelledby="start-heading">
    <div class="start-intro">
      <p class="kicker">Marriage.Family.Therapy</p>
      <h1 id="start-heading">How to start therapy.</h1>
      <p class="start-lead">You do not need to have every answer before you begin. Clarify what you are looking for, get to know our clinicians, and choose your next step.</p>
      <a class="start-text-link" href="#start-steps">See the three steps <span aria-hidden="true">&darr;</span></a>
    </div>
    <aside class="start-options" id="appointment-options" aria-labelledby="start-options-heading">
      <p class="kicker">Choose where to begin</p>
      <h2 id="start-options-heading">Ready to connect?</h2>
      <a class="start-button start-button-gold" href="${SCHEDULE}">Free 10-minute consultation <span aria-hidden="true">&rarr;</span></a>
      <a class="start-button start-button-outline" href="${SCHEDULE}">Request an appointment <span aria-hidden="true">&rarr;</span></a>
      <p class="start-helper">Both options open SimplePractice. Choose the appointment type there; a request is not a confirmed appointment.</p>
      <div class="start-benefits">
        <h3>Have a benefits question first?</h3>
        <a class="start-button start-button-outline" href="${BENEFITS}">Verify benefits <span aria-hidden="true">&nearr;</span></a>
        <p class="start-helper">Opens your email app to contact support@mft.care. Please leave insurance numbers and clinical details out of the initial email.</p>
      </div>
    </aside>
  </section>
  <section class="start-section" id="start-steps" aria-labelledby="start-steps-heading">
    <div class="start-section-heading"><p class="kicker">A simple way forward</p><h2 id="start-steps-heading">Three steps. Your starting point.</h2></div>
    <ol class="start-step-grid">
      <li><span class="start-number" aria-hidden="true">01</span><h3>Clarify what you are looking for</h3><p>Start with the service that sounds closest to what you need. You do not have to choose a therapy approach first.</p><a class="start-button start-button-green" href="/services/">Explore services <span aria-hidden="true">&rarr;</span></a></li>
      <li><span class="start-number" aria-hidden="true">02</span><h3>Review clinician information</h3><p>Read the profiles and compare who each clinician works with, their focus areas, and their approach.</p><a class="start-button start-button-green" href="/team/">Meet the team <span aria-hidden="true">&rarr;</span></a></li>
      <li><span class="start-number" aria-hidden="true">03</span><h3>Schedule</h3><p>Choose a consultation or appointment in SimplePractice. Confirm the service and available time before sending a request.</p><a class="start-button start-button-green" href="${SCHEDULE}">Schedule in SimplePractice <span aria-hidden="true">&rarr;</span></a></li>
    </ol>
  </section>
  <section class="start-section start-faq-section" id="start-questions" aria-labelledby="start-faq-heading">
    <div class="start-section-heading"><p class="kicker">Common questions</p><h2 id="start-faq-heading">A few practical answers.</h2><p>Need help finding the right place to go? Start here.</p></div>
    <div class="start-faq">
      <details><summary>Where do I request a consultation or appointment?</summary><p>The consultation and appointment buttons open our SimplePractice scheduling options. Choose the appointment type and clinician there. Sending a request does not by itself confirm the appointment.</p></details>
      <details><summary>How do I ask about insurance benefits?</summary><p>Use the Verify benefits button to open an email to support@mft.care. Ask the support team how to begin a benefits check without including insurance numbers or clinical details in that initial message.</p></details>
      <details><summary>Where do existing clients sign in?</summary><p>Use the <a href="${SCHEDULE}">existing client portal</a> for SimplePractice. The staff Operations link in the footer is separate from ordinary appointment scheduling.</p></details>
      <details><summary>Where can I find Marriage.Reset?</summary><p>Choose <a href="/marriagereset/">Marriage.Reset</a> in the top navigation. That page includes a separate sign-in link for Marriage.Reset clients.</p></details>
    </div>
    <div class="start-support"><div><h3>Have a different question?</h3><p>Contact the support team about the practice or how to get started.</p></div><a class="start-button start-button-green" href="${QUESTION}">Ask support a question <span aria-hidden="true">&nearr;</span></a></div>
  </section>
</main>`;
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
module.exports = { applyPlaudEdits, startMain, SCHEDULE, BENEFITS, QUESTION, MR_ACCESS };
