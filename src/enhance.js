const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const DIST=path.join(ROOT,'dist');
const SITE='https://www.mft.care';
for(const asset of ['mft-logo.svg','mft-logo-white.svg']) fs.copyFileSync(path.join(ROOT,'src','assets',asset),path.join(DIST,'assets',asset));

const bookingMap={
  '/':'homepage',
  '/online-therapy-washington/':'online-therapy',
  '/marriage-and-couples-therapy-counseling/':'couples-therapy',
  '/team/':'team',
  '/check-my-coverage/':'insurance',
  '/therapy-contact-woodinville/':'contact-page',
  '/marriagereset/':'marriage-reset',
  '/new-page/':'individual-therapy',
  '/services/':'services',
  '/childrentherapy/':'child-therapy',
  '/teen-counseling/':'teen-therapy',
  '/family-therapy-group-counseling/':'family-therapy',
  '/new-page-1/':'premarital',
  '/online-therapy-king-county-wa/':'king-county',
  '/online-therapy-snohomish-county-wa/':'snohomish-county'
};
const slugify=s=>s.replace(/^\/+|\/+$/g,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'')||'homepage';
const placementFor=p=>bookingMap[p]||slugify(p);
const booking=p=>'https://marriagefamilytherapy.clientsecure.me';

function walk(dir){
  const out=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const f=path.join(dir,e.name);
    if(e.isDirectory()) out.push(...walk(f));
    else if(e.name.endsWith('.html')) out.push(f);
  }
  return out;
}
function routeFor(file){
  const rel=path.relative(DIST,file).split(path.sep).join('/');
  if(rel==='index.html') return '/';
  if(rel==='404.html') return '/404.html';
  return '/'+rel.replace(/index\.html$/,'');
}
function consultationBlock(route){
  const href=booking(route);
  const couplesRoutes=new Set(['/marriage-and-couples-therapy-counseling/','/marriagereset/','/new-page-1/','/new-page-2/']);
  const couples=couplesRoutes.has(route);
  const intro=couples
    ? 'Not everyone needs the same first step. Choose a quick introduction, a couples consultation, or request a couples therapy appointment.'
    : 'Not everyone needs the same first appointment. Choose a quick introduction, a focused consultation, or begin individual therapy with a full diagnostic evaluation.';
  const second=couples
    ? `<article class="option-card"><p class="option-time">30 minutes · private pay</p><h3>Couples consultation</h3><p>More time for both partners to understand the clinician, the practice, and possible next steps before deciding whether to begin couples care.</p><a class="text-link" href="${href}">Schedule a couples consultation →</a></article>`
    : `<article class="option-card"><p class="option-time">26 minutes · private pay</p><h3>Individual consultation</h3><p>More time to understand the clinician, the practice, and possible next steps before deciding whether to begin ongoing individual care.</p><a class="text-link" href="${href}">Schedule a consultation →</a></article>`;
  const third=couples
    ? `<article class="option-card"><p class="option-time">Private pay</p><h3>Couples therapy</h3><p>Request a couples therapy appointment when you are ready to begin clinical work rather than an introductory consultation.</p><a class="text-link" href="${href}">Request a couples appointment →</a></article>`
    : `<article class="option-card"><p class="option-time">53 minutes</p><h3>Initial diagnostic session</h3><p>The standard clinical starting point for individual clients: a diagnostic evaluation focused on medical necessity, a working diagnosis, and an initial treatment plan when appropriate.</p><a class="text-link" href="${href}">Start with an initial session →</a></article>`;
  return `<section class="section start-options reveal" aria-labelledby="start-options-title"><div class="section-heading"><p class="kicker">Choose how to begin</p><h2 id="start-options-title">Start with the amount of support that fits right now.</h2><p>${intro}</p></div><div class="option-grid">
  <article class="option-card"><p class="option-time">10 minutes · free</p><h3>Meet-and-greet</h3><p>A brief phone introduction for a new client to ask a few practical questions and get a feel for the clinician. It is complimentary one time. The calendar may reserve 15 minutes, but the conversation is limited to 10 minutes.</p><a class="text-link" href="${href}" data-mft-free-consultation>Schedule a free consultation →</a></article>
  ${second}
  ${third}
  </div><p class="option-note">${couples?'Couples consultations and couples sessions are private pay.':'Insurance coverage for individual clinical services depends on clinical appropriateness, clinician participation, and plan benefits.'}</p></section>`;
}
function purposeBlock(route){
  if(route==='/services/') return `<section class="section purpose-panel reveal"><div class="section-heading"><p class="kicker">Find your fit</p><h2>Search care by person, concern, format, or approach.</h2><p>Use the site as a decision tool—not a catalogue. Start with who needs care, then narrow by what is happening and how you want to meet.</p></div><div class="decision-grid"><a href="/team/"><b>By clinician</b><span>Compare populations served, specialties, and approaches.</span></a><a href="/what-we-help-with/"><b>By concern</b><span>Start with anxiety, relationships, ADHD, grief, trauma, family stress, and more.</span></a><a href="/therapy-approaches/"><b>By modality</b><span>Explore CBT, DBT skills, EFT, Gottman-informed, family systems, and other approaches.</span></a><a href="/online-therapy-washington/"><b>By format</b><span>Compare Woodinville in-person care with statewide telehealth.</span></a></div></section>`;
  if(route==='/what-we-help-with/') return `<section class="section purpose-panel reveal"><div class="section-heading"><p class="kicker">Turn information into a next step</p><h2>Explore the concern, then compare clinicians who may fit.</h2><p>Each guide is orientation—not a diagnosis. Use it to understand common therapy targets, then move to clinician profiles and scheduling.</p></div><div class="decision-grid"><a href="/team/"><b>Compare therapists</b><span>See populations served, focus areas, and treatment approaches.</span></a><a href="/services/"><b>Compare services</b><span>Individual, couples, child, teen, family, and premarital care.</span></a><a href="/therapy-approaches/"><b>Explore modalities</b><span>Learn how different approaches may fit different goals.</span></a><a href="${booking(route)}"><b>Schedule now</b><span>Open SimplePractice directly when you are ready.</span></a></div></section>`;
  if(route==='/resources/') return `<section class="section purpose-panel reveal"><div class="section-heading"><p class="kicker">Useful, not filler</p><h2>Resources should help you make a decision or learn something worthwhile.</h2><p>Start with our practical guides, then use trusted outside sources when you want to explore a topic independently.</p></div><div class="decision-grid"><a href="https://www.nimh.nih.gov/health" rel="noopener"><b>NIMH mental health information</b><span>Evidence-based overviews of common mental health conditions and treatment.</span></a><a href="https://www.samhsa.gov/find-help" rel="noopener"><b>SAMHSA help resources</b><span>National treatment and support resources.</span></a><a href="https://988lifeline.org/" rel="noopener"><b>988 Lifeline</b><span>Crisis support for people in the United States.</span></a><a href="/team/"><b>Find a therapist</b><span>Move from general information to the clinicians and services available at M.F.T.</span></a></div></section>`;
  if(route==='/online-therapy-washington/') return `<section class="section purpose-panel reveal"><div class="section-heading"><p class="kicker">Statewide access</p><h2>Use online therapy to choose for fit—not just driving distance.</h2><p>Explore clinicians, approaches, concerns, and Washington service areas. Telehealth is available only when clinically appropriate and while the client is physically located in Washington.</p></div><div class="decision-grid"><a href="/team/"><b>Choose a clinician</b><span>Compare specialties and approaches across the team.</span></a><a href="/online-therapy-locations/"><b>Browse Washington locations</b><span>Find service-area information for communities and counties.</span></a><a href="/therapy-approaches/"><b>Explore modalities</b><span>Understand the methods represented across clinician profiles.</span></a><a href="${booking(route)}"><b>Request an online appointment</b><span>Continue through SimplePractice scheduling.</span></a></div></section>`;
  if(route==='/') return `<section class="section purpose-panel reveal"><div class="section-heading"><p class="kicker">Find the right starting point</p><h2>Care should make sense before the first full session.</h2><p>Explore the team, compare services, learn how different therapy approaches work, or choose a starting appointment.</p></div><div class="decision-grid"><a href="/team/"><b>Meet the team</b><span>See who works with adults, couples, children, teens, and families.</span></a><a href="/services/"><b>Explore services</b><span>Compare populations, formats, concerns, and treatment pathways.</span></a><a href="/therapy-approaches/"><b>Explore modalities</b><span>Learn about the approaches represented across our clinicians.</span></a><a href="/marriage-reset-assessment/"><b>Try Marriage.Reset</b><span>Begin with the free relationship assessment and discover what deserves attention.</span></a></div></section>`;
  return '';
}
function homepageOverride(html){
  const consult='https://marriagefamilytherapy.clientsecure.me/';
  const verify='mailto:support@mft.care?subject=Verify%20my%20therapy%20benefits';
  const ui=require('./ui/home-components');
  const home=require('../content/homepage.json');
  const hero=ui.hero(home.hero);
  const intro=ui.cards(home.questions);
  const steps=ui.steps(home.steps);
  const faq=ui.faq(home.faq);
  html=html.replace(/<nav class="breadcrumbs"[\s\S]*?<\/nav>/,'');
  html=html.replace(/<section class="hero">[\s\S]*?<\/section>/,hero);
  html=html.replace(/<section class="section purpose-panel reveal">[\s\S]*?<\/section>/,intro+steps+faq);
  html=html.replace(/<section class="section start-options reveal"[\s\S]*?<\/section>/,'');
  html=html.replace(/<section class="section related reveal">[\s\S]*?<\/section>/,'');
  html=html.replace(/<a class="nav-action" href="[^"]+">Request appointment<\/a>/,`<a class="nav-action" href="${consult}">Free consultation</a>`);
  return html;
}

function replaceGenericSections(html,route){
  const purpose=purposeBlock(route);
  if(purpose){
    html=html.replace(/<section class="section content-section reveal">[\s\S]*?<\/section>/,purpose);
  }
  if(['/','/services/','/what-we-help-with/','/online-therapy-washington/','/resources/'].includes(route)){
    html=html.replace(/<section class="section focus-section reveal">[\s\S]*?<\/section>/,'');
  }
  return html;
}
function enhanceHtml(file){
  const route=routeFor(file);
  let h=fs.readFileSync(file,'utf8');
  if(route==='/404.html') return;
  h=h.replace('<span class="brand-mark">M.F.T.</span>','<img class="brand-logo" src="/assets/mft-logo.svg" alt="" aria-hidden="true">');
  h=h.replace('<a class="footer-brand" href="/">Marriage.Family.Therapy</a>','<a class="footer-brand brand-footer" href="/"><img src="/assets/mft-logo-white.svg" alt="" aria-hidden="true"><span>Marriage.Family.Therapy</span></a>');
  h=h.replace(/<a class="nav-action" href="https:\/\/ops\.mft\.care\/">Request appointment<\/a>/g,`<a class="nav-action" href="${booking(route)}">Request appointment</a>`);
  h=h.replace(/<a class="button (?:primary|light)" href="https:\/\/ops\.mft\.care\/">Request appointment<\/a>/g,m=>m.replace('https://ops.mft.care/',booking(route)));
  h=h.replace(/<a href="https:\/\/ops\.mft\.care\/">Request appointment<\/a>/g,`<a href="${booking(route)}">Request appointment</a>`);
  h=h.replace(/<a class="button ghost" href="https:\/\/ops\.mft\.care\/">Request appointment<\/a>/g,`<a class="button ghost" href="${booking(route)}">Request appointment</a>`);
  h=replaceGenericSections(h,route);
  if(route==='/') h=homepageOverride(h);
  if(route!=='/' && !route.startsWith('/marriage-reset-assessment/')){
    const block=consultationBlock(route);
    h=h.replace(/<section class="section final-cta reveal">/,block+'<section class="section final-cta reveal">');
  }
  h=h.replace('<p><a href="https://ops.mft.care/">Request appointment</a><br><a href="mailto:support@mft.care?subject=Benefits%20verification">Verify benefits</a><br><a href="https://marriagefamilytherapy.clientsecure.me/">Existing client portal</a></p>',
    `<p><a href="${booking(route)}">Request appointment</a><br><a href="https://ops.mft.care/">Verify insurance</a><br><a href="https://marriagefamilytherapy.clientsecure.me/">Existing client portal</a><br><a href="https://ops.mft.care/" rel="nofollow">Staff operations</a></p>`);
  fs.writeFileSync(file,h);
}
for(const f of walk(DIST)) enhanceHtml(f);

const cssPath=path.join(DIST,'assets/styles.css');
fs.appendFileSync(cssPath,`


.brand-logo{width:46px;height:46px;object-fit:contain}.brand-footer{display:flex;align-items:center;gap:.8rem}.brand-footer img{width:46px;height:46px}.purpose-panel{background:#fff}.decision-grid,.option-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1rem;margin-top:2rem}.decision-grid a,.option-card{border-top:3px solid var(--gold);background:var(--mist);padding:1.4rem;text-decoration:none;min-height:180px}.decision-grid b,.decision-grid span{display:block}.decision-grid b{font:500 1.35rem var(--serif);margin-bottom:.55rem}.decision-grid span{color:#496866}.start-options{background:#f4f0e7}.option-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.option-card{background:#fff}.option-time{text-transform:uppercase;letter-spacing:.12em;font-size:.72rem;font-weight:700;color:var(--teal)}.option-card h3{margin:.25rem 0 .7rem}.option-note{max-width:900px;margin:1.5rem 0 0;color:#496866}.staff-card{display:grid;grid-template-columns:160px 1fr;gap:1.5rem;align-items:center;margin-top:2rem;border-top:1px solid var(--line);padding-top:1.5rem}.staff-card img{width:160px;aspect-ratio:4/5;object-fit:cover}.hero-media{filter:saturate(.86) contrast(.96)}@media(max-width:900px){.decision-grid{grid-template-columns:repeat(2,1fr)}.option-grid{grid-template-columns:1fr}}@media(max-width:600px){.decision-grid{grid-template-columns:1fr}.brand-logo{width:40px;height:40px}}
`);

fs.appendFileSync(cssPath,fs.readFileSync(path.join(ROOT,'src/assets/home-system.css'),'utf8'));
const jsPath=path.join(DIST,'assets/site.js');

function makeAdPage(sourceRoute,adRoute,title,h1,summary,placement){
  const source=sourceRoute==='/'?path.join(DIST,'index.html'):path.join(DIST,sourceRoute,'index.html');
  let h=fs.readFileSync(source,'utf8');
  const canonical=SITE+'/'+adRoute+'/';
  h=h.replace(/<title>.*?<\/title>/,`<title>${title}</title>`);
  h=h.replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${summary}">`);
  h=h.replace(/<meta name="robots" content="[^"]*">/,'<meta name="robots" content="noindex,nofollow">');
  h=h.replace(/<link rel="canonical" href="[^"]*">/,`<link rel="canonical" href="${canonical}">`);
  h=h.replace(/<meta property="og:title" content="[^"]*">/,`<meta property="og:title" content="${title}">`);
  h=h.replace(/<meta property="og:description" content="[^"]*">/,`<meta property="og:description" content="${summary}">`);
  h=h.replace(/<meta property="og:url" content="[^"]*">/,`<meta property="og:url" content="${canonical}">`);
  h=h.replace(/<h1>.*?<\/h1>/,`<h1>${h1}</h1>`);
  h=h.replace(/<p class="hero-summary">.*?<\/p>/,`<p class="hero-summary">${summary}</p>`);
  h=h.replace('<nav class="breadcrumbs" aria-label="Breadcrumb">','<div class="ad-note">Google Ads landing page · SimplePractice scheduling</div><nav class="breadcrumbs" aria-label="Breadcrumb">');
  const out=path.join(DIST,adRoute,'index.html'); fs.mkdirSync(path.dirname(out),{recursive:true}); fs.writeFileSync(out,h);
}
makeAdPage('/','google/therapy-woodinville','Therapy in Woodinville | Marriage.Family.Therapy','Therapy in Woodinville for individuals, couples, children, teens, and families.','Explore clinicians and services, then choose a free 10-minute consultation, a focused consultation, or an initial clinical session.','google-ads-woodinville');
makeAdPage('marriage-and-couples-therapy-counseling','google/couples-therapy','Couples Therapy in Woodinville | M.F.T.','Couples therapy focused on understanding the pattern—not choosing a side.','Explore relationship care, Marriage.Reset, and a tracked pathway to schedule couples services.','google-ads-couples');
makeAdPage('online-therapy-washington','google/online-therapy-washington','Online Therapy Across Washington | M.F.T.','Online therapy across Washington State.','Choose clinicians by fit, focus area, and approach without limiting the search to driving distance.','google-ads-online');
makeAdPage('new-page','google/individual-therapy','Individual Therapy in Woodinville & Washington | M.F.T.','Individual therapy with a clear way to begin.','Start with a free 10-minute consultation, a focused consultation, or the standard 53-minute diagnostic evaluation.','google-ads-individual');

fs.appendFileSync(cssPath,'.ad-note{background:var(--gold);color:#102f2e;text-align:center;padding:.45rem 1rem;font-size:.78rem;font-weight:700}\n');
console.log(JSON.stringify({enhanced:true,googleAdsLandingPages:4,tracking:'therapy scheduling goes directly to SimplePractice; Ops is not used for client booking'},null,2));
