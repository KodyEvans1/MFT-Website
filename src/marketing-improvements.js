'use strict';
// Five existing routes, composed after approved page bodies and before the SEO
// fingerprints. New copy is review-only until revision-specific approval exists.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ui = require('./ui/home-components');
const scheduling = require('./scheduling-actions');
const booking = require('./booking-build');
const core = require('./booking-core');
const {indexingEnabled} = require('./seo-safety');
const copy = require('../content/marketing-improvements.json');
const review = require('../content/marketing-improvements-review.json');
const people = require('../content/clinician-registry.json').clinicians;
const ROOT = path.resolve(__dirname, '..');
const CSS = 'marketing-improvements.css';
const revisionFiles = [
  'src/build.js', 'src/site-urls.js',
  'content/marketing-improvements.json', 'src/marketing-improvements.js',
  'src/assets/marketing-improvements.css', 'src/scheduling-actions.js',
  'content/clinician-registry.json', 'content/clinician-evidence.json',
  'content/simplepractice-booking.json', 'content/sonia-profile.json',
  'content/site-experience.json', 'content/reference-pages/individual.json',
  'content/service-guides/marriage-and-couples-therapy-counseling.json',
  'src/ui/home-components.js', 'src/site-experience.js', 'src/launch-content.js',
  'src/booking-core.js', 'src/booking-build.js',
  'scripts/prepare-booking.js', 'src/seo-expansion-engine.js'
];
const revision = () => {
  const hash = crypto.createHash('sha256');
  for (const file of revisionFiles) hash.update(file).update('\0').update(fs.readFileSync(path.join(ROOT, file))).update('\0');
  return hash.digest('hex');
};
function approved(record = review, current = revision()) {
  return record.contentRevision === current && ['clinical', 'operational', 'publication'].every(key => {
    const a = record.approvals?.[key];
    return a?.status === 'approved' && typeof a.reviewer === 'string' && a.reviewer.trim() &&
      typeof a.evidence === 'string' && a.evidence.trim() && a.reviewedRevision === current;
  });
}
function enabled(env = process.env, record = review) {
  return !(String(env.CONTEXT || '').toLowerCase() === 'production' || indexingEnabled(env)) || Boolean(approved(record));
}
function clinician(key) {
  if (!key) return null;
  const person = booking.config.clinicians.find(c => c.key === key);
  if (!person) throw Error('Unverified marketing booking identity: ' + key);
  return person;
}
function button(p, placement = 'primary', variant = 'primary') {
  const person = clinician(p.clinician);
  return `<a class="button ${variant}" data-ui="button" data-mft-booking-intent="${p.kind === 'couples' ? 'consultation' : 'appointment'}" data-marketing-appointment="${placement}"${person ? ` data-mft-clinician="${ui.esc(person.key)}"` : ''}${p.kind === 'couples' ? ' data-mft-couples-consultation="true"' : ''} href="${ui.esc(core.destination(booking.config, person))}" rel="noopener noreferrer" aria-describedby="marketing-scheduling-help">${ui.esc(p.primary)}</a>`;
}
const consultationButton = label => ui.button({href:scheduling.REQUEST,label},'outline-dark').replace('<a ', '<a data-mft-booking-intent="consultation" ');
function instructions(p) {
  if (p.kind === 'couples') return '<p>Choose the 30-minute couples consultation in SimplePractice. Do not select a 53-minute couples session before the consultation and both partner evaluations are complete.</p>';
  const name = p.clinician ? clinician(p.clinician).name.split(' ')[0] : 'a clinician';
  return `<p>In SimplePractice, confirm ${ui.esc(name)} and choose the initial clinical evaluation when offered. ${p.kind === 'individual' ? 'Choose the appropriate office or Telehealth location.' : 'Choose Telehealth when offered for online individual care.'}</p><p>The link selects ${p.clinician ? ui.esc(name) : 'the practice'}; it does not preselect a service, format, or time. If the evaluation or appropriate format is not listed, <a href="mailto:support@mft.care">contact the practice</a> for the next step. Do not choose another service just to reserve a time.</p>`;
}
function help(p, id = 'marketing-scheduling-help') {
  return `<details class="marketing-help" id="${id}"><summary>Before opening SimplePractice</summary>${instructions(p)}<p>An appointment request is not a confirmed appointment. Keep private clinical information out of ordinary email.</p></details>`;
}
function clinicianCards(p) {
  const cards = p.profileKeys.map(key => {
    const c = clinician(key), person = people.find(x => x.slug === c.slug && x.status === 'current');
    if (!person || !person.populations.includes('adults')) throw Error('Unsupported adult profile: ' + key);
    return `<article class="marketing-clinician-card" data-clinician="${ui.esc(c.slug)}"><p class="kicker">Explore the existing profile</p><h3>${ui.esc(c.name)}</h3><p class="marketing-credential">${ui.esc(person.credential)}</p><p>Read about ${ui.esc(c.name.split(' ')[0])}'s approach and the age groups and services described in the practice biography. Confirm individual telehealth fit, current appointment options, and payment before care.</p><p><a href="/${ui.esc(c.slug)}/">Meet ${ui.esc(c.name.split(' ')[0])} &rarr;</a></p>${button({kind:'clinician',clinician:key,primary:`Request an Online Appointment With ${c.name.split(' ')[0]}`},'clinician','outline-dark')}</article>`;
  }).join('');
  return `<section class="section marketing-clinicians mft-component" id="clinicians" aria-labelledby="marketing-clinicians-title">${ui.heading({id:'marketing-clinicians',kicker:'Find a clinician who fits',title:'Explore approaches before choosing care.',intro:'These practice profiles describe adult care. The practice confirms telehealth suitability, current appointment options, and payment for your situation.'})}<div class="marketing-clinician-grid">${cards}</div><p><a href="/team/">View the full team</a></p></section>`;
}
function triCities(p) {
  const hero = ui.hero({kicker:p.eyebrow,title:p.title,summary:p.summary,actions:[],note:p.note,
    panel:{kicker:'Online in Washington',title:'Care without a drive to Woodinville.',paragraphs:[p.location],items:[{title:'Check Insurance Benefits',text:'Coverage depends on your plan, service, and clinician.',href:'/check-my-coverage/'}]}})
    .replace('<div class="actions"></div>', `<div class="actions">${button(p)}${ui.button({href:p.secondaryHref,label:p.secondary},'ghost')}</div><p class="marketing-benefits"><a href="/check-my-coverage/">Check Insurance Benefits &rarr;</a></p>`);
  return `<main id="main" class="marketing-tricities" data-marketing-route="online-therapy-tri-cities-wa" data-design-system="homepage-shared-v1">
${hero}
<div class="marketing-help-wrap">${help(p)}</div>
${clinicianCards(p)}
<section class="section marketing-payment mft-component" id="payment" aria-labelledby="marketing-payment-title"><p class="kicker">Payment and insurance</p><h2 id="marketing-payment-title">Check your benefits and likely costs.</h2><p>Coverage and out-of-pocket costs depend on your plan, benefits, service, and clinician. Confirm those details before care. A listed insurance company does not guarantee coverage for every clinician or appointment.</p><p>Ask about private-pay fees or the secure process for a benefits check. Do not send member numbers or clinical details in ordinary email.</p>${ui.button({href:'/check-my-coverage/',label:'Check Insurance Benefits'},'outline-dark')}</section>
${ui.steps({id:'getting-started',kicker:'A clear starting point',title:'How to begin online care.',items:copy.gettingStarted})}
<section class="section marketing-consultations mft-component" id="optional-consultations" aria-labelledby="marketing-consultations-title"><p class="kicker">An optional conversation first</p><h2 id="marketing-consultations-title">Choose the start that fits your needs.</h2><p>Individual care can begin with an initial clinical evaluation. A consultation is optional and is not a therapy session or diagnostic evaluation.</p><div class="marketing-clinician-grid"><article data-ui="card"><h3>Free 10-minute phone consultation</h3><p>A brief introduction to discuss fit and the care process. If arranged by video and the technology does not work immediately, this becomes a phone call.</p>${consultationButton('Request a Free 10-minute Phone Consultation')}</article><article data-ui="card"><h3>Paid 30-minute individual consultation</h3><p>More time to discuss fit and questions. Confirm the applicable fee before requesting it; this is separate from the clinical evaluation.</p>${consultationButton('Request a Paid 30-minute Individual Consultation')}</article></div></section>
${ui.faq({id:'questions',kicker:'Practical telehealth questions',title:'Know what happens next.',items:copy.questions})}
<section class="section marketing-repeat mft-component" aria-labelledby="marketing-next-title"><p class="kicker">Your next step</p><h2 id="marketing-next-title">Request your online individual appointment.</h2><p>${ui.esc(p.note)}</p>${button(p,'repeated','dark')}<p><a href="/how-to-start-therapy/#individual-journey">Read the individual care journey</a></p></section>
<aside class="section marketing-related mft-component" aria-label="Other care"><p>Looking for couples care? <a href="/marriage-and-couples-therapy-counseling/">Explore the couples service and required starting steps</a>. Couples consultations and therapy sessions are private pay.</p><p><a href="/services/">Explore all services</a> or <a href="${scheduling.PORTAL}" data-mft-existing-client="true" rel="noopener noreferrer">open the Existing Client Portal</a>.</p></aside>
</main>`;
}
function service(html, slug, p) {
  const page = require('./reference-pages').get(slug);
  const original = html.match(/<section class="home-hero mft-component"[\s\S]*?<\/section>/)?.[0];
  if (!html.includes(`data-reference-page="${slug}"`) || !original) throw Error('Marketing service entry must extend the current approved composition: ' + slug);
  const hero = ui.hero({...page.hero,summary:p.summary,actions:[],note:p.note})
    .replace('<div class="actions"></div>', `<div class="actions">${button(p)}${ui.button({href:p.secondaryHref,label:p.secondary},'ghost')}</div>`);
  let out = html.replace(original,hero + `<div class="marketing-help-wrap">${help(p)}</div>`);
  if (p.kind === 'individual') out = out.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/g, (whole, attrs, body) => {
    if (!body.includes('<b>Diagnostic evaluation (90791)</b>')) return whole;
    // This specific existing card is a request action even though its supporting
    // explanation also mentions insurance. Never relabel an ordinary benefits link.
    return `<a data-mft-booking-intent="appointment"${attrs}>${body}</a>`;
  });
  const block = `<section class="section marketing-repeat mft-component" aria-labelledby="marketing-next-title"><h2 id="marketing-next-title">${ui.esc(p.primary)}</h2><p>${ui.esc(p.note)}</p>${button(p,'repeated','dark')}</section>`;
  return out.replace('<section class="section mft-sources',block + '<section class="section mft-sources');
}
function profile(html, p) {
  let found = false;
  let out = html.replace(/<section class="hero mft-clinician-hero"[\s\S]*?<\/section>/,hero => {
    found = true;
    return hero.replace(/<div class="actions">[\s\S]*?<\/div>/,`<p class="marketing-profile-note" id="marketing-scheduling-help">In SimplePractice, confirm ${ui.esc(clinician(p.clinician).name.split(' ')[0])}, then choose the initial clinical evaluation and Telehealth when offered. This link selects the clinician; service, format, and time are not preselected.</p><div class="actions">${button(p)}${ui.button({href:'/check-my-coverage/',label:'Check Insurance Benefits'},'ghost')}</div><p class="marketing-profile-note">${ui.esc(p.summary)}</p>`);
  });
  if (!found) throw Error('Marketing profile must preserve the existing clinician hero');
  // Append outside the biography: the owner-approved prose and portrait remain exact.
  const block = `<section class="section marketing-repeat mft-component" aria-labelledby="marketing-next-title"><p class="kicker">Your next step</p><h2 id="marketing-next-title">${ui.esc(p.primary)}</h2><p>${ui.esc(p.summary)}</p>${help(p,'marketing-detailed-help')}${button(p,'repeated','dark')}<p>For teen care or another service in this profile, confirm the appropriate service and age range with the practice. Couples follow the <a href="/how-to-start-therapy/#couples-journey">required couples consultation and evaluation sequence</a>.</p></section>`;
  return out.replace('</main>',block + '</main>');
}
function metadata(html,p) {
  const title=p.title+' | M.F.T.', description='Online individual therapy for adults in Kennewick, Pasco, Richland, and West Richland. Explore clinician fit, payment options, and how to request care.';
  return html.replace(/<title>[\s\S]*?<\/title>/,`<title>${ui.esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${ui.esc(description)}">`)
    .replace(/<meta property="og:(title|description)" content="[^"]*">/g,(_,key)=>`<meta property="og:${key}" content="${ui.esc(key==='title'?title:description)}">`)
    .replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,(_,raw)=>{
      const data=JSON.parse(raw);
      for(const node of data['@graph']||[])if(node['@type']==='WebPage'){node.name=title;node.description=description;}
      return '<script type="application/ld+json">'+JSON.stringify(data).replace(/</g,'\\u003c')+'</script>';
    });
}
function apply(html, route, env = process.env) {
  const slug=String(route).replace(/^\/+|\/+$/g,''), p=copy.routes[slug];
  if(!p || !enabled(env) || html.includes('data-marketing-candidate='))return html;
  let out=p.kind==='regional-individual' ? metadata(html.replace(/<main\b[^>]*>[\s\S]*?<\/main>/,triCities(p)),p) : p.kind==='clinician' ? profile(html,p) : service(html,slug,p);
  const footerRequest=button(p,'footer-utility').replace('class="button primary" data-ui="button"','data-mft-booking-utility="request"');
  out=scheduling.forPage(out,{primary:button(p,'header'),footerPrimary:button(p,'footer','light'),footerRequest,couples:p.kind==='couples',note:ui.esc(p.note||p.summary)});
  out=out.replace(/<body\b/,'<body data-marketing-candidate="20261118"');
  const version=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'assets',CSS))).digest('hex').slice(0,16);
  out=out.replace('</head>',`<link rel="stylesheet" href="/assets/${CSS}?v=${version}"></head>`);
  return booking.decorateHtml(out,'/'+slug+'/').html;
}
function prepare(dist) {
  fs.copyFileSync(path.join(__dirname,'assets',CSS),path.join(dist,'assets',CSS));
  fs.mkdirSync(path.join(dist,'reports'),{recursive:true});
  fs.writeFileSync(path.join(dist,'reports/marketing-review.json'),JSON.stringify({version:1,revision:revision(),recordedRevision:review.contentRevision,publicationApproved:Boolean(approved()),candidateRendered:enabled(),routes:Object.keys(copy.routes),approvals:review.approvals,measurement:'separate existing consent/privacy gate'},null,2)+'\n');
}
module.exports={apply,prepare,enabled,approved,revision,copy,review,button,triCities};
