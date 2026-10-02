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
const booking=p=>`https://ops.mft.care/go/book?placement=${encodeURIComponent(placementFor(p))}`;

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
  return `<section class="section start-options reveal" aria-labelledby="start-options-title"><div class="section-heading"><p class="kicker">Choose how to begin</p><h2 id="start-options-title">Start with the amount of support that fits right now.</h2><p>Not everyone needs the same first appointment. Choose a quick introduction, a focused consultation, or begin individual therapy with a full diagnostic evaluation.</p></div><div class="option-grid">
  <article class="option-card"><p class="option-time">10 minutes · free</p><h3>Meet-and-greet</h3><p>A brief phone introduction to ask a few practical questions and get a feel for the clinician. The calendar may reserve 15 minutes, but the conversation is limited to 10 minutes.</p><a class="text-link" href="${href}">Schedule a free consultation →</a></article>
  <article class="option-card"><p class="option-time">30 minutes</p><h3>Focused consultation</h3><p>More time to understand the clinician, the practice, and possible next steps before deciding whether to begin ongoing care.</p><a class="text-link" href="${href}">Schedule a consultation →</a></article>
  <article class="option-card"><p class="option-time">53 minutes</p><h3>Initial diagnostic session</h3><p>The standard clinical starting point for individual clients: a diagnostic evaluation focused on medical necessity, a working diagnosis, and an initial treatment plan when appropriate.</p><a class="text-link" href="${href}">Start with an initial session →</a></article>
  </div><p class="option-note">Couples services, including couples consultations, are private pay. Insurance coverage for individual services depends on clinical appropriateness, clinician participation, and plan benefits.</p></section>`;
}
function purposeBlock(route){
  if(route==='/services/') return `<section class="section purpose-panel reveal"><div class="section-heading"><p class="kicker">Find your fit</p><h2>Search care by person, concern, format, or approach.</h2><p>Use the site as a decision tool—not a catalogue. Start with who needs care, then narrow by what is happening and how you want to meet.</p></div><div class="decision-grid"><a href="/team/"><b>By clinician</b><span>Compare populations served, specialties, and approaches.</span></a><a href="/what-we-help-with/"><b>By concern</b><span>Start with anxiety, relationships, ADHD, grief, trauma, family stress, and more.</span></a><a href="/therapy-approaches/"><b>By modality</b><span>Explore CBT, DBT skills, EFT, Gottman-informed, family systems, and other approaches.</span></a><a href="/online-therapy-washington/"><b>By format</b><span>Compare Woodinville in-person care with statewide telehealth.</span></a></div></section>`;
  if(route==='/what-we-help-with/') return `<section class="section purpose-panel reveal"><div class="section-heading"><p class="kicker">Turn information into a next step</p><h2>Explore the concern, then compare clinicians who may fit.</h2><p>Each guide is orientation—not a diagnosis. Use it to understand common therapy targets, then move to clinician profiles and scheduling.</p></div><div class="decision-grid"><a href="/team/"><b>Compare therapists</b><span>See populations served, focus areas, and treatment approaches.</span></a><a href="/services/"><b>Compare services</b><span>Individual, couples, child, teen, family, and premarital care.</span></a><a href="/therapy-approaches/"><b>Explore modalities</b><span>Learn how different approaches may fit different goals.</span></a><a href="${booking(route)}"><b>Schedule now</b><span>Use the tracked appointment pathway when you are ready.</span></a></div></section>`;
  if(route==='/resources/') return `<section class="section purpose-panel reveal"><div class="section-heading"><p class="kicker">Useful, not filler</p><h2>Resources should help you make a decision or learn something worthwhile.</h2><p>Start with our practical guides, then use trusted outside sources when you want to explore a topic independently.</p></div><div class="decision-grid"><a href="https://www.nimh.nih.gov/health" rel="noopener"><b>NIMH mental health information</b><span>Evidence-based overviews of common mental health conditions and treatment.</span></a><a href="https://www.samhsa.gov/find-help" rel="noopener"><b>SAMHSA help resources</b><span>National treatment and support resources.</span></a><a href="https://988lifeline.org/" rel="noopener"><b>988 Lifeline</b><span>Crisis support for people in the United States.</span></a><a href="/team/"><b>Find a therapist</b><span>Move from general information to the clinicians and services available at M.F.T.</span></a></div></section>`;
  if(route==='/online-therapy-washington/') return `<section class="section purpose-panel reveal"><div class="section-heading"><p class="kicker">Statewide access</p><h2>Use online therapy to choose for fit—not just driving distance.</h2><p>Explore clinicians, approaches, concerns, and Washington service areas. Telehealth is available only when clinically appropriate and while the client is physically located in Washington.</p></div><div class="decision-grid"><a href="/team/"><b>Choose a clinician</b><span>Compare specialties and approaches across the team.</span></a><a href="/online-therapy-locations/"><b>Browse Washington locations</b><span>Find service-area information for communities and counties.</span></a><a href="/therapy-approaches/"><b>Explore modalities</b><span>Understand the methods represented across clinician profiles.</span></a><a href="${booking(route)}"><b>Request an online appointment</b><span>Continue through the tracked scheduling pathway.</span></a></div></section>`;
  if(route==='/') return `<section class="section purpose-panel reveal"><div class="section-heading"><p class="kicker">Find the right starting point</p><h2>Care should make sense before the first full session.</h2><p>Explore the team, compare services, learn how different therapy approaches work, or choose a starting appointment.</p></div><div class="decision-grid"><a href="/team/"><b>Meet the team</b><span>See who works with adults, couples, children, teens, and families.</span></a><a href="/services/"><b>Explore services</b><span>Compare populations, formats, concerns, and treatment pathways.</span></a><a href="/therapy-approaches/"><b>Explore modalities</b><span>Learn about the approaches represented across our clinicians.</span></a><a href="/marriage-reset-assessment/"><b>Try Marriage.Reset</b><span>Begin with the free relationship assessment and discover what deserves attention.</span></a></div></section>`;
  return '';
}
function homepageOverride(html){
  const consult='https://marriagefamilytherapy.clientsecure.me/';
  const verify='mailto:support@mft.care?subject=Verify%20my%20therapy%20benefits';
  const hero=`<section class="home-hero">
    <div class="home-hero-copy">
      <p class="kicker">Marriage.Family.Therapy</p>
      <h1>Find the right therapist. Start in the way that feels manageable.</h1>
      <p class="hero-summary">Therapy for individuals, couples, children, teens, and families in Woodinville, with secure online care across Washington.</p>
      <div class="actions">
        <a class="button primary" href="${consult}">Schedule a free 10-minute consultation</a>
        <a class="button ghost" href="/team/">Meet the team</a>
      </div>
    </div>
    <div class="home-hero-panel">
      <p class="kicker">A clearer first step</p>
      <h2>Not sure where to begin?</h2>
      <p>Choose what you need first. You can understand your options before committing to ongoing care.</p>
      <div class="quick-actions">
        <a href="/services/"><b>Explore services</b><span>Individual, couples, child, teen, family, and premarital care.</span></a>
        <a href="/team/"><b>Find a clinician</b><span>Compare populations served, specialties, and approaches.</span></a>
        <a href="${verify}"><b>Verify benefits</b><span>Email our support team to start an insurance-benefit check.</span></a>
      </div>
    </div>
  </section>`;
  const intro=`<section class="section home-questions">
    <div class="section-heading"><p class="kicker">Start with the questions that matter most</p><h2>What kind of help are you looking for?</h2><p>Most people do not arrive knowing the exact service or therapy model they need. Start with who needs support and what is getting in the way.</p></div>
    <div class="question-grid">
      <a href="/new-page/"><b>Support for me</b><span>Individual therapy for adults navigating anxiety, depression, ADHD, stress, grief, relationships, and transitions.</span></a>
      <a href="/marriage-and-couples-therapy-counseling/"><b>Support for us</b><span>Couples and marriage therapy for conflict, distance, trust, communication, and connection.</span></a>
      <a href="/childrentherapy/"><b>Support for my child</b><span>Developmentally appropriate care for children and families.</span></a>
      <a href="/teen-counseling/"><b>Support for my teen</b><span>A respectful place for teens to build skills, confidence, and understanding.</span></a>
    </div>
  </section>`;
  const steps=`<section class="section home-steps">
    <div class="section-heading"><p class="kicker">How to begin</p><h2>Three clear steps from searching to care.</h2></div>
    <div class="step-grid">
      <article><span>01</span><h3>Clarify what you are looking for</h3><p>Start with a service, concern, or therapist profile that sounds closest to what is happening now.</p><a href="/services/">Explore services →</a></article>
      <article><span>02</span><h3>Review clinician information</h3><p>Compare who they work with, focus areas, approaches, and whether you prefer in-person or online care.</p><a href="/team/">Meet the team →</a></article>
      <article><span>03</span><h3>Schedule your next step</h3><p>Book a free 10-minute consultation or move directly into the appropriate first clinical appointment.</p><a href="${consult}">Schedule now →</a></article>
    </div>
  </section>`;
  const faq=`<section class="section home-faq">
    <div class="section-heading"><p class="kicker">Common questions</p><h2>Answers before you schedule.</h2></div>
    <div class="faq-grid">
      <details><summary>Can I talk with a therapist before starting?</summary><p>Yes. We offer a free 10-minute phone meet-and-greet so you can ask practical questions and get a feel for the clinician before deciding what to do next.</p></details>
      <details><summary>Can I start with a full session instead?</summary><p>Yes. For individual clients, the standard clinical starting point may be a 53-minute diagnostic evaluation when appropriate.</p></details>
      <details><summary>Do you offer online therapy?</summary><p>Yes. Secure telehealth may be available to eligible clients who are physically located in Washington at the time of care.</p></details>
      <details><summary>How do I check insurance benefits?</summary><p><a href="${verify}">Email support@mft.care</a> to start a benefits-verification request. Coverage depends on the clinician, service, plan, and network status.</p></details>
    </div>
    <p class="faq-contact">Still unsure? <a href="mailto:support@mft.care?subject=Website%20question">Ask our support team a question.</a></p>
  </section>`;
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
  h=h.replace('<p><a href="https://ops.mft.care/">Request appointment</a><br><a href="https://ops.mft.care/">Verify insurance</a><br><a href="https://marriagefamilytherapy.clientsecure.me/">Existing client portal</a></p>',
    `<p><a href="${booking(route)}">Request appointment</a><br><a href="https://ops.mft.care/">Verify insurance</a><br><a href="https://marriagefamilytherapy.clientsecure.me/">Existing client portal</a><br><a href="https://ops.mft.care/" rel="nofollow">Staff operations</a></p>`);
  fs.writeFileSync(file,h);
}
for(const f of walk(DIST)) enhanceHtml(f);

const cssPath=path.join(DIST,'assets/styles.css');
fs.appendFileSync(cssPath,`
.home-hero{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(320px,.8fr);gap:clamp(2rem,5vw,5rem);padding:clamp(4rem,8vw,7rem) clamp(1rem,7vw,7rem);background:linear-gradient(135deg,#f7f3ea 0%,#edf4f1 100%);align-items:center}.home-hero-copy h1{font-size:clamp(3.2rem,6vw,6rem);max-width:900px;color:var(--deep)}.home-hero-copy .hero-summary{color:#355f5c;font-size:1.2rem}.home-hero .button.primary{background:var(--ink);color:#fff;border-color:var(--ink)}.home-hero .button.ghost{color:var(--ink);border-color:var(--ink)}.home-hero-panel{background:var(--deep);color:#fff;padding:clamp(1.5rem,4vw,3rem);border-radius:24px;box-shadow:0 24px 60px rgba(16,47,46,.12)}.home-hero-panel h2{font-size:clamp(2rem,4vw,3.4rem)}.quick-actions{display:grid;margin-top:1.6rem;border-top:1px solid rgba(255,255,255,.22)}.quick-actions a{display:grid;gap:.2rem;padding:1rem 0;border-bottom:1px solid rgba(255,255,255,.22);text-decoration:none}.quick-actions b{font:500 1.15rem var(--serif)}.quick-actions span{font-size:.9rem;color:#d8e7e2}.home-questions{background:#fff}.question-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-top:2.5rem}.question-grid a{display:block;padding:1.6rem;background:var(--mist);border-radius:18px;text-decoration:none;border:1px solid rgba(23,62,60,.08)}.question-grid b,.question-grid span{display:block}.question-grid b{font:500 1.45rem var(--serif);margin-bottom:.55rem}.question-grid span{color:#4e6d6a}.home-steps{background:#f4f0e7}.step-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1.25rem;margin-top:2rem}.step-grid article{background:#fff;padding:1.7rem;border-radius:18px;border-top:4px solid var(--gold)}.step-grid article>span{font-weight:700;color:var(--teal);letter-spacing:.1em}.step-grid h3{font-size:1.55rem}.step-grid a{font-weight:700;text-underline-offset:.18em}.home-faq{background:var(--deep);color:#fff}.home-faq .kicker{color:var(--gold)}.faq-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1rem;margin-top:2rem}.faq-grid details{background:rgba(255,255,255,.06);padding:1.25rem;border:1px solid rgba(255,255,255,.14);border-radius:14px}.faq-grid summary{font:500 1.18rem var(--serif);cursor:pointer}.faq-grid p{color:#d8e7e2}.faq-contact{margin-top:1.5rem}.faq-contact a,.faq-grid a{color:#fff}@media(max-width:900px){.home-hero{grid-template-columns:1fr}.question-grid{grid-template-columns:repeat(2,1fr)}.step-grid{grid-template-columns:1fr}}@media(max-width:600px){.question-grid,.faq-grid{grid-template-columns:1fr}.home-hero-copy h1{font-size:2.75rem}}

.brand-logo{width:46px;height:46px;object-fit:contain}.brand-footer{display:flex;align-items:center;gap:.8rem}.brand-footer img{width:46px;height:46px}.purpose-panel{background:#fff}.decision-grid,.option-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1rem;margin-top:2rem}.decision-grid a,.option-card{border-top:3px solid var(--gold);background:var(--mist);padding:1.4rem;text-decoration:none;min-height:180px}.decision-grid b,.decision-grid span{display:block}.decision-grid b{font:500 1.35rem var(--serif);margin-bottom:.55rem}.decision-grid span{color:#496866}.start-options{background:#f4f0e7}.option-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.option-card{background:#fff}.option-time{text-transform:uppercase;letter-spacing:.12em;font-size:.72rem;font-weight:700;color:var(--teal)}.option-card h3{margin:.25rem 0 .7rem}.option-note{max-width:900px;margin:1.5rem 0 0;color:#496866}.staff-card{display:grid;grid-template-columns:160px 1fr;gap:1.5rem;align-items:center;margin-top:2rem;border-top:1px solid var(--line);padding-top:1.5rem}.staff-card img{width:160px;aspect-ratio:4/5;object-fit:cover}.hero-media{filter:saturate(.86) contrast(.96)}@media(max-width:900px){.decision-grid{grid-template-columns:repeat(2,1fr)}.option-grid{grid-template-columns:1fr}}@media(max-width:600px){.decision-grid{grid-template-columns:1fr}.brand-logo{width:40px;height:40px}}
`);

const jsPath=path.join(DIST,'assets/site.js');
fs.appendFileSync(jsPath,`
;(()=>{const q=new URLSearchParams(location.search);const gclid=q.get('gclid');const src=q.get('utm_source');if(!gclid && src!=='google')return;document.querySelectorAll('a[href^="https://ops.mft.care/go/book"]').forEach(a=>{const u=new URL(a.href);u.searchParams.set('placement','google-'+(u.searchParams.get('placement')||'site'));for(const k of ['gclid','utm_source','utm_medium','utm_campaign','utm_term','utm_content']){const v=q.get(k);if(v)u.searchParams.set(k,v)}a.href=u.toString()})})();
`);

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
  h=h.replace(/https:\/\/ops\.mft\.care\/go\/book\?placement=[^"&<]+/g,`https://ops.mft.care/go/book?placement=${placement}`);
  h=h.replace('<nav class="breadcrumbs" aria-label="Breadcrumb">','<div class="ad-note">Google Ads landing page · tracked scheduling pathway</div><nav class="breadcrumbs" aria-label="Breadcrumb">');
  const out=path.join(DIST,adRoute,'index.html'); fs.mkdirSync(path.dirname(out),{recursive:true}); fs.writeFileSync(out,h);
}
makeAdPage('/','google/therapy-woodinville','Therapy in Woodinville | Marriage.Family.Therapy','Therapy in Woodinville for individuals, couples, children, teens, and families.','Explore clinicians and services, then choose a free 10-minute consultation, a focused consultation, or an initial clinical session.','google-ads-woodinville');
makeAdPage('marriage-and-couples-therapy-counseling','google/couples-therapy','Couples Therapy in Woodinville | M.F.T.','Couples therapy focused on understanding the pattern—not choosing a side.','Explore relationship care, Marriage.Reset, and a tracked pathway to schedule couples services.','google-ads-couples');
makeAdPage('online-therapy-washington','google/online-therapy-washington','Online Therapy Across Washington | M.F.T.','Online therapy across Washington State.','Choose clinicians by fit, focus area, and approach without limiting the search to driving distance.','google-ads-online');
makeAdPage('new-page','google/individual-therapy','Individual Therapy in Woodinville & Washington | M.F.T.','Individual therapy with a clear way to begin.','Start with a free 10-minute consultation, a focused consultation, or the standard 53-minute diagnostic evaluation.','google-ads-individual');

fs.appendFileSync(cssPath,'.ad-note{background:var(--gold);color:#102f2e;text-align:center;padding:.45rem 1rem;font-size:.78rem;font-weight:700}\n');
console.log(JSON.stringify({enhanced:true,googleAdsLandingPages:4,tracking:'appointment links use page-specific placement; Google Ads URLs preserve gclid/UTMs'},null,2));
