'use strict';
// Shared, native links. These explain prerequisites; they do not read clinical
// records or claim to enforce appointment permissions inside SimplePractice.
const PORTAL = 'https://marriagefamilytherapy.clientsecure.me/sign-in';
const REQUEST = 'https://marriagefamilytherapy.clientsecure.me/request';
const GUIDE = '/how-to-start-therapy/';
function existingButton() {
  return `<a class="mft-schedule-button mft-schedule-existing" data-mft-existing-client="true" href="${PORTAL}" rel="noopener noreferrer">Existing clients: schedule an appointment</a>`;
}
function couplesButton() {
  return `<a class="mft-schedule-button mft-schedule-couples" data-mft-couples-consultation="true" href="${REQUEST}" rel="noopener noreferrer">Schedule a 30-minute couples consultation</a>`;
}
function shortcuts() {
  return `<aside class="mft-schedule-shortcuts" data-scheduling-actions="20261029" aria-label="Appointment scheduling"><div class="mft-schedule-shortcuts-inner"><div class="mft-schedule-shortcuts-actions">${existingButton()}${couplesButton()}</div><p>Returning clients: sign in to request your next appointment. Starting couples care: choose the paid 30-minute consultation, not a 53-minute couples session. <a href="${GUIDE}#couples-journey">See the required steps</a>.</p></div></aside>`;
}
function homeActions() {
  return `<div class="mft-home-scheduling" data-scheduling-actions="20261029"><div class="mft-home-scheduling-choice"><a class="mft-schedule-button" href="${REQUEST}" rel="noopener noreferrer">Schedule a free 10-minute consultation</a><p>Optional phone introduction for individuals and couples.</p></div><div class="mft-home-scheduling-choice">${couplesButton()}<p>Required first step for couples. Paid; no 10-minute call required first.</p></div><div class="mft-home-scheduling-choice">${existingButton()}<p>Sign in to your Client Portal. Couples sessions follow the consultation and both partner evaluations.</p></div><a class="mft-scheduling-text-link" href="/team/">Meet the team &rarr;</a></div>`;
}
function existingSection() {
  return `<section class="start-section mft-returning-section" id="existing-clients" aria-labelledby="existing-clients-heading"><div class="start-section-heading"><p class="kicker">Already receiving care?</p><h2 id="existing-clients-heading">Schedule your next appointment.</h2><p>Use your existing SimplePractice Client Portal rather than starting a new-client request. After signing in, open Appointments and use Request appointment when available. A request is not confirmed until the practice accepts it.</p></div><div class="mft-returning-grid"><article><h3>Returning for individual care</h3><p>Request the appointment type you have agreed on with your clinician. You do not need another introductory consultation to continue individual care.</p>${existingButton()}<p class="start-helper">If appointment requests or the correct service are not shown, contact your clinician or support. Do not choose a different appointment type just to reserve a time.</p></article><article id="returning-couples"><h3>Returning for couples care</h3><p><strong>Do not schedule the initial or an ongoing 53-minute couples session until the 30-minute couples consultation and a separate diagnostic evaluation for each partner have been completed.</strong></p><p>Already being an individual client, having a Client Portal login, or completing a 10-minute call does not replace these steps.</p><details class="mft-couples-readiness"><summary>We have completed the consultation and both partner evaluations</summary><p>Request your couples session through your existing Client Portal. If you are unsure whether the preparation is complete, confirm with your couples therapist first.</p>${existingButton()}</details><p class="start-helper">This checklist is guidance, not a check of your clinical record. Your clinician confirms readiness and the correct appointment type.</p><p>Not yet completed the 30-minute consultation? ${couplesButton()}</p><p>Consultation completed, but one or both partner evaluations still needed? Contact your couples clinician to arrange the remaining evaluation before requesting a joint session.</p></article></div></section>`;
}
function apply(html) {
  let out = html;
  if (!out.includes('data-scheduling-actions="20261029"')) {
    out = out.replace('</header>', '</header>' + shortcuts());
  }
  out = out.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/, footer => {
    if (footer.includes('class="mft-footer-scheduling"')) return footer;
    return footer.replace(/(<footer\b[^>]*>)/, '$1' + `<div class="mft-footer-scheduling"><h2>Schedule the right appointment</h2><div class="mft-schedule-shortcuts-actions">${existingButton()}${couplesButton()}</div><p>Couples: 30-minute consultation &rarr; one evaluation for each partner &rarr; initial 53-minute couples session. A 10-minute call is optional and does not replace these steps.</p></div>`);
  });
  return out;
}
module.exports = {PORTAL, REQUEST, GUIDE, existingButton, couplesButton, homeActions, existingSection, apply};
