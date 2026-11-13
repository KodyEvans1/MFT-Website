'use strict';
// Bounded landing-page composition. No clinician openings, plan participation,
// booking completion, or tracking readiness are inferred from public profiles.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {esc} = require('./ui/home-components');
const scheduling = require('./scheduling-actions');
const ROUTE = '/online-therapy-tri-cities-wa/';
const TITLE = 'Online Therapy for Adults in the Tri-Cities | M.F.T.';
const DESCRIPTION = 'Online individual therapy for adults in Kennewick, Pasco, Richland and West Richland. Explore clinician fit, payment options and your first evaluation.';
const VERSION = '20261105';
const CSS = 'tricities-pilot.css';
const request = label => `<a class="button dark" data-pilot-appointment="true" href="${scheduling.REQUEST}" rel="noopener noreferrer" aria-describedby="pilot-scheduling-help">${label}</a>`;
function main() {
  return `<main id="main" class="tc-pilot" data-tricities-pilot="${VERSION}">
<section class="section tc-hero" aria-labelledby="tc-title">
  <div><p class="kicker">Individual care, wherever you are in Washington</p>
  <h1 id="tc-title">Online Therapy for Adults in the Tri-Cities</h1>
  <p class="tc-lead">Meet with an M.F.T. clinician by secure video from a private location in Washington. Explore clinician fit, review payment options, and request an online individual appointment.</p>
  <p class="tc-location">Serving Kennewick, Pasco, Richland, West Richland, and surrounding Washington communities online. Our physical office is in Woodinville; no travel there is required for telehealth.</p>
  <div class="tc-actions">${request('Request an Online Appointment')}<a class="tc-secondary" href="#optional-consultations">Explore an Optional Consultation &rarr;</a></div>
  <a class="tc-benefits" href="/check-my-coverage/">Check Insurance Benefits &rarr;</a></div>
  <aside class="tc-instructions" aria-labelledby="tc-first-title"><p class="kicker">Your first clinical appointment</p><h2 id="tc-first-title">You can start with an evaluation.</h2>
  <p>No consultation is required before individual care. Request a diagnostic evaluation (90791) to discuss your concerns, relevant history, and goals and begin a measurable treatment plan.</p>
  <div id="pilot-scheduling-help"><h3>When SimplePractice opens</h3><p>Choose a clinician who works with adults, the initial diagnostic evaluation, and the Telehealth location when offered. Confirm that the appointment is for individual online care.</p><p>If the appropriate service, video option, or time is not listed, ask support rather than selecting a different service to reserve a time. An appointment request is not a confirmed appointment.</p></div></aside>
</section>
<section class="section tc-path" aria-labelledby="tc-path-title"><p class="kicker">A clear path into care</p><h2 id="tc-path-title">From your first request to purposeful care.</h2>
  <ol class="tc-grid"><li><span>01</span><h3>Choose your starting point</h3><p>Request your diagnostic evaluation directly, or choose an optional consultation to discuss fit and questions first.</p></li><li><span>02</span><h3>Meet online for your evaluation</h3><p>Join from a private location in Washington. Your clinician gathers information about your concerns and goals and considers which approaches suit your needs.</p></li><li><span>03</span><h3>Work from a measurable plan</h3><p>Agree on goals, the rhythm of appointments, and how progress will be reviewed. Your clinician will discuss whether telehealth remains appropriate for your care.</p></li></ol>
</section>
<section class="section tc-consultations" id="optional-consultations" aria-labelledby="tc-consultations-title"><p class="kicker">A conversation first, only when helpful</p><h2 id="tc-consultations-title">Consultations are optional for individuals.</h2>
  <p>A consultation is optional. You may request an initial clinical evaluation directly. Consultations are not therapy sessions or diagnostic evaluations. Any applicable consultation fee will be explained before scheduling.</p>
  <div class="tc-grid tc-two"><article><p class="kicker">Optional &middot; free</p><h3>10-minute phone consultation</h3><p>A brief introduction for questions about fit and next steps. Occasionally arranged by telehealth; if technology does not work immediately, it becomes a phone call. Calls may display Marriage.Family.Therapy or a hidden number.</p><a class="button outline-dark" href="${scheduling.REQUEST}" rel="noopener noreferrer">Schedule a free 10-minute phone consultation</a></article><article><p class="kicker">Optional &middot; paid</p><h3>30-minute individual consultation</h3><p>More time to discuss fit, questions, and the care process. This is a paid appointment, separate from the diagnostic evaluation. Confirm the fee before scheduling.</p><a class="button outline-dark" href="${scheduling.REQUEST}" rel="noopener noreferrer">Request a paid 30-minute individual consultation</a></article></div>
  <p class="tc-note">Neither option is a prerequisite for your individual diagnostic evaluation. No separate email or promotional code is needed to request an appointment.</p>
</section>
<section class="section tc-fit" aria-labelledby="tc-fit-title"><p class="kicker">Choose a clinician, not a commute</p><h2 id="tc-fit-title">Find the right fit for your individual care.</h2><p>Review approved clinician profiles for credentials, focus areas, and approaches. Confirm adult telehealth suitability and current openings before requesting care; availability and appointment types vary by clinician.</p><a class="button outline-dark" href="/team/">Explore clinician profiles</a></section>
<section class="section tc-payment" aria-labelledby="tc-payment-title"><p class="kicker">Payment without assumptions</p><h2 id="tc-payment-title">Check benefits and likely costs before care.</h2><p>Insurance coverage and out-of-pocket costs depend on your plan, benefits, service, and clinician. Ask the support team to verify your benefits before care begins. Verification is not a guarantee of coverage or payment.</p><p>Private-pay options can also be discussed. Do not send insurance numbers, clinical details, or other sensitive information in an ordinary email; ask support for the approved secure process.</p><a class="button outline-dark" href="/check-my-coverage/">Check Insurance Benefits</a></section>
<section class="section tc-close" aria-labelledby="tc-close-title"><p class="kicker">Your next step</p><h2 id="tc-close-title">Request your online individual appointment.</h2><p>In SimplePractice, look for an adult individual diagnostic evaluation and Telehealth with an appropriate clinician. Confirm the appointment type, format, and fees before care.</p>${request('Request an Online Appointment')}<p class="tc-note"><a href="/how-to-start-therapy/#individual-journey">Read the full individual-care journey</a></p></section>
<section class="section tc-other" aria-labelledby="tc-other-title"><h2 id="tc-other-title">Looking for another kind of care?</h2><p><a href="/services/">Explore other services</a>, or <a href="/how-to-start-therapy/#couples-journey">review the couples pathway</a>. Couples consultations and couples therapy are private pay. Couples begin with the required 30-minute consultation, then one separate evaluation per partner, before joint 53-minute sessions. A 10-minute introduction is optional.</p><p>${scheduling.existingButton()}</p></section>
</main>`;
}
function prepare(dist) {
  fs.copyFileSync(path.join(__dirname,'assets',CSS),path.join(dist,'assets',CSS));
}
function apply(html, route) {
  if ('/' + String(route).replace(/^\/+|\/+$/g,'') + '/' !== ROUTE) return html;
  if (html.includes(`data-tricities-pilot="${VERSION}"`)) return html;
  if (!/<main\b[^>]*>[\s\S]*?<\/main>/.test(html)) throw Error('Tri-Cities pilot main region missing');
  let out=html.replace(/<main\b[^>]*>[\s\S]*?<\/main>/,main());
  out=out.replace(/<header\b[^>]*>[\s\S]*?<\/header>/,header=>header.replace(/(<a\b[^>]*class="nav-action"[^>]*>)[\s\S]*?<\/a>/,'$1Request an Online Appointment</a>'));
  out=out.replace(/<aside class="mft-schedule-shortcuts"[\s\S]*?<\/aside>/,`<aside class="tc-returning" data-scheduling-actions="20261029" aria-label="Existing client scheduling">${scheduling.existingButton()}<span>Already receiving care? Use your Client Portal.</span></aside>`);
  out=out.replace(/<title>[\s\S]*?<\/title>/,`<title>${esc(TITLE)}</title>`);
  for (const [attribute,key,value] of [['name','description',DESCRIPTION],['property','og:title',TITLE],['property','og:description',DESCRIPTION]]) {
    out=out.replace(new RegExp(`<meta ${attribute}="${key}" content="[^"]*">`),`<meta ${attribute}="${key}" content="${esc(value)}">`);
  }
  out=out.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,(tag,json)=>{
    const schema=JSON.parse(json);
    for(const node of schema['@graph']||[])if(node['@type']==='WebPage'){node.name=TITLE;node.description=DESCRIPTION;}
    return '<script type="application/ld+json">'+JSON.stringify(schema).replace(/</g,'\\u003c')+'</script>';
  });
  const version=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'assets',CSS))).digest('hex').slice(0,16);
  return out.replace('</head>',`<link rel="stylesheet" href="/assets/${CSS}?v=${version}"></head>`);
}
module.exports={apply,prepare,main,ROUTE,TITLE,DESCRIPTION};
