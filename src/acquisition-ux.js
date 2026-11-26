'use strict';
// Final, targeted composition for the owner's November 25 acquisition UX request.
// Clinical biographies, canonical routes and booking mechanics remain their source
// modules' responsibility. These links select a clinician, never a service or slot.
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {esc} = require('./ui/home-components');
const booking = require('./booking-build');
const core = require('./booking-core');
const scheduling = require('./scheduling-actions');
const {costs, inlineEvaluationPrice, renderStartingCosts} = require('./appointment-costs');

const CSS = 'acquisition-ux.css';
const GUIDE = '/how-to-start-therapy/#starting-costs';
const COUPLES = '/marriage-and-couples-therapy-counseling/';
const CONTENT_ROUTES = Object.freeze([
  'emily-johnsrud-bio', 'autumn-alexander', 'new-page',
  'marriage-and-couples-therapy-counseling', 'online-therapy-washington'
]);
const STYLE_ROUTES = Object.freeze(['how-to-start-therapy', 'check-my-coverage']);
const ROUTES = Object.freeze([...CONTENT_ROUTES, ...STYLE_ROUTES]);
const profiles = Object.freeze({
  // The owner described Emily's current ad as individual telehealth. Fresh public
  // SimplePractice catalogue and evaluation/consultation location menus also
  // confirmed Telehealth + Woodinville for Emily and Autumn on 2026-11-26.
  // See reports/ACQUISITION-UX-FACTS-20261125.md; no appointment time was selected.
  'emily-johnsrud-bio': {
    key: 'emily', firstName: 'Emily', kicker: 'Individual telehealth in Washington',
    ages: 'children ages 6+, teens, and adults',
    summary: 'Individual therapy with Emily for',
    format: 'Telehealth for clients physically in Washington, with in-person care also offered in Woodinville. Confirm the appointment format, appropriate service, and current options with Emily before booking.',
    couples: true
  },
  // Owner-approved autumn-profile.json and clinician-registry.json support 6+ and
  // individual populations. Clinician-specific formats now have live public-menu
  // evidence, independent of the practicewide footer; this is not an openings claim.
  'autumn-alexander': {
    key: 'autumn', firstName: 'Autumn', kicker: 'Individual therapy with Autumn',
    ages: 'children ages 6+, teens, young adults, and adults',
    summary: 'Individual support for',
    format: 'In-person care in Woodinville and telehealth for clients physically in Washington. Confirm the appointment format with Autumn before booking, along with the appropriate service and current options.',
    couples: false
  }
});

function clinicianFor(p) {
  const person = booking.config.clinicians.find(c => c.key === p.key);
  if (!person) throw new Error('Missing verified acquisition booking identity: ' + p.key);
  return person;
}

function evaluationButton(p, placement = 'primary', variant = 'primary') {
  const person = clinicianFor(p);
  const label = `Request an Individual Evaluation With ${p.firstName}`;
  return `<a class="button ${variant}" data-ui="button" data-acquisition-appointment="${placement}" data-mft-booking-intent="appointment" data-mft-clinician="${esc(person.key)}" href="${esc(core.destination(booking.config, person))}" rel="noopener noreferrer" aria-describedby="${p.key}-evaluation-price ${p.key}-scheduling-help">${esc(label)}</a>`;
}

function evaluationPrice(id) {
  return `<div class="acquisition-payment" data-acquisition-payment id="${id}"><p><strong>Initial individual evaluation: ${esc(inlineEvaluationPrice())}.</strong></p><p>Coverage and your cost depend on the clinician, service, plan, and benefits. <a href="/check-my-coverage/">Check insurance benefits</a> before relying on coverage.</p></div>`;
}

function bookingHelp(p) {
  return `<details class="acquisition-booking-help" id="${p.key}-scheduling-help"><summary>What to choose in SimplePractice</summary><p>This link selects ${esc(p.firstName)}. Choose the initial individual evaluation when offered, then confirm the appropriate format and time. The service, format, and time are not preselected.</p><p>If the evaluation or appropriate format is not shown, <a href="mailto:support@mft.care">contact the practice</a> for the next step. Do not choose another service just to reserve a time. Keep private clinical information out of ordinary email.</p><p>An appointment request is not a confirmed appointment.</p></details>`;
}

function secondaryPaths(p) {
  const couples = p.couples ? `<p>Looking for couples care? <a href="${COUPLES}">Read the couples service and starting steps</a>.</p>` : '';
  return `<div class="acquisition-secondary" data-acquisition-secondary>${couples}<p>Already a client? <a data-mft-existing-client="true" href="${scheduling.PORTAL}" rel="noopener noreferrer">Sign in to your Client Portal</a>.</p></div>`;
}

function clinicianPage(html, slug, p) {
  const heroPattern = /<section class="hero mft-clinician-hero"[\s\S]*?<\/section>/;
  const original = html.match(heroPattern)?.[0];
  if (!original || !original.includes(`data-clinician-hero="${slug}"`)) {
    throw new Error('Acquisition UX requires the existing clinician hero: ' + slug);
  }
  const costId = p.key + '-starting-costs';
  let hero = original.replace(/<p class="kicker">[\s\S]*?<\/p>/, `<p class="kicker">${esc(p.kicker)}</p>`)
    .replace(/<p class="hero-summary">[\s\S]*?<\/p>/,
      `<p class="hero-summary">${esc(p.summary)} <span data-acquisition-age-range>${esc(p.ages)}</span>.</p><p class="acquisition-format" data-acquisition-format>${esc(p.format)}</p>`)
    .replace(/<div class="actions">[\s\S]*?<\/div>/,
      `${evaluationPrice(p.key + '-evaluation-price')}<div class="actions">${evaluationButton(p)}</div><p class="acquisition-optional">You can request an individual evaluation directly. Prefer a conversation first? <a href="#${costId}">Compare optional consultations</a>.</p>`);
  let out = html.replace(original, hero + `<div class="acquisition-entry-details">${bookingHelp(p)}${secondaryPaths(p)}</div>` +
    renderStartingCosts({context:'individual', idPrefix:costId}));

  const repeated = `<h2>Request your individual evaluation with ${esc(p.firstName)}.</h2><p>${esc(p.format)}</p><p>Initial individual evaluation: ${esc(inlineEvaluationPrice())}. Confirm benefits for the clinician and service before relying on coverage.</p>${evaluationButton(p, 'repeated', 'dark')}<p><a href="/check-my-coverage/">Check insurance benefits</a> or <a href="/how-to-start-therapy/#individual-journey">read the individual care journey</a>. A consultation is optional; an appointment request is subject to confirmation.</p>`;
  if (p.key === 'autumn') {
    // Only the existing scheduling subsection changes. The owner-authored
    // biography, education, focus areas and treatment descriptions are retained.
    const appointmentSection = /<section class="experience-prose" id="autumn-appointments">[\s\S]*?<\/section>/;
    if (!appointmentSection.test(out)) throw new Error('Autumn appointment subsection changed');
    out = out.replace(appointmentSection, `<section class="experience-prose acquisition-next-step" id="autumn-appointments">${repeated}</section>`);
  } else {
    out = out.replace('</main>', `<section class="section acquisition-next-step" aria-label="Request an individual evaluation with Emily">${repeated}</section></main>`);
  }

  out = scheduling.forPage(out, {
    primary: evaluationButton(p, 'header'),
    footerPrimary: evaluationButton(p, 'footer', 'light'),
    footerRequest: evaluationButton(p, 'footer-utility').replace('class="button primary" data-ui="button"', 'data-mft-booking-utility="request"'),
    note: 'Individual care can begin with the initial evaluation. Consultations are optional. Requests are subject to confirmation.'
  });
  // forPage has a practicewide couples link. Autumn's page keeps its existing
  // individual-only scheduling scope; family-support experience is not an offer
  // of couples care. Emily's separate couples service link remains available.
  if (!p.couples) out = out.replace(' · <a href="' + COUPLES + '">Explore couples care</a>', '');
  return out;
}

function couplesPrice() {
  const short = costs.services.shortConsultation;
  const hour = costs.services.couplesHourConsultation;
  return `<div class="acquisition-payment" data-acquisition-payment id="couples-starting-price"><p><strong>Required short couples consultation: $${short.feeUsd} private pay.</strong> A ${short.durationMinutes}-minute conversation in a ${short.bookingBlockMinutes}-minute appointment block.</p><p>The separate one-hour couples consultation is $${hour.feeUsd} private pay. <a href="#couples-starting-costs">Compare the distinct options</a> before choosing a service.</p></div>`;
}

function servicePage(html, slug) {
  const individual = slug === 'new-page';
  const original = html.match(/<section class="home-hero mft-component"[\s\S]*?<\/section>/)?.[0];
  if (!original || !html.includes(`data-reference-page="${slug}"`)) {
    throw new Error('Acquisition UX requires the approved service composition: ' + slug);
  }
  if (!original.includes('data-marketing-appointment="primary"')) {
    throw new Error('Acquisition UX requires the reviewed service appointment action: ' + slug);
  }
  const costId = individual ? 'individual-starting-costs' : 'couples-starting-costs';
  const price = individual ? evaluationPrice('individual-evaluation-price') : couplesPrice();
  // Retain the complete approved hero, its primary CTA label/native attributes,
  // the clinical body and the care sequence. Add price information before action.
  const hero = original.replace('<div class="actions">', price + '<div class="actions">');
  return html.replace(original, hero + renderStartingCosts({context:individual ? 'individual' : 'couples', idPrefix:costId}));
}

function onlinePage(html) {
  const original = html.match(/<section class="hero mft-typographic-hero"[\s\S]*?<\/section>/)?.[0];
  if (!original) throw new Error('Acquisition UX requires the existing Washington online hero');
  // This is the existing statewide service page, not a statement that every
  // clinician or service is offered online. Preserve its eligibility language.
  const hero = original.replace('<div class="actions">', evaluationPrice('online-evaluation-price') + '<div class="actions">')
    .replace('<a class="button primary"', '<a class="button primary" data-acquisition-appointment="primary" data-mft-booking-intent="appointment"')
    .replace(/<a class="button ghost"[^>]*>Verify benefits<\/a>/,
      '<a class="button ghost" href="/check-my-coverage/">Check insurance benefits</a>')
    .replace('</div></div></section>', `</div><p class="acquisition-online-path">Starting individual care? <a href="/how-to-start-therapy/#individual-journey">Read the individual care journey</a> and <a href="${GUIDE}">compare starting costs</a>. Confirm telehealth eligibility, clinician, service, and appointment options before booking.</p></div></section>`);
  return html.replace(original, hero + renderStartingCosts({context:'individual', idPrefix:'online-starting-costs'}));
}

function apply(html, route) {
  const slug = String(route || '').replace(/^\/+|\/+$/g, '');
  if (!ROUTES.includes(slug)) return html;
  if (html.includes('data-acquisition-ux="20261125"')) {
    // The starting-guide pass deliberately replaces its complete main region
    // later in the build. Restore its scope marker without duplicating content.
    return STYLE_ROUTES.includes(slug) && !html.includes(`data-acquisition-route="${slug}"`)
      ? addStyles(html.replace(/<main\b/, `<main data-acquisition-route="${slug}"`)) : html;
  }
  const stylesOnly = STYLE_ROUTES.includes(slug);
  let out = stylesOnly ? html : profiles[slug] ? clinicianPage(html, slug, profiles[slug]) :
    slug === 'online-therapy-washington' ? onlinePage(html) : servicePage(html, slug);
  out = out.replace(/<body\b/, '<body data-acquisition-ux="20261125"')
    .replace(/<main\b/, `<main data-acquisition-route="${slug}"`);
  out = addStyles(out);
  return stylesOnly ? out : booking.decorateHtml(out, '/' + slug + '/').html;
}

function addStyles(html) {
  if (html.includes('/assets/' + CSS)) return html;
  const version = createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'assets', CSS))).digest('hex').slice(0, 16);
  return html.replace('</head>', `<link rel="stylesheet" href="/assets/${CSS}?v=${version}"></head>`);
}

function prepare(dist) {
  fs.mkdirSync(path.join(dist, 'assets'), {recursive:true});
  fs.copyFileSync(path.join(__dirname, 'assets', CSS), path.join(dist, 'assets', CSS));
}

module.exports = {apply, addStyles, prepare, routes:ROUTES, contentRoutes:CONTENT_ROUTES};
