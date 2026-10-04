const fs=require('fs');
const path=require('path');
const presentation=require('./ui/clinician-presentation');
const ROOT=path.resolve(__dirname,'..');
const DIST=path.join(ROOT,'dist');
const CONSULT='https://marriagefamilytherapy.clientsecure.me/';
const VERIFY='mailto:support@mft.care?subject=Verify%20my%20therapy%20benefits';
const CHARLENE='https://images.squarespace-cdn.com/content/v1/65b78566ba645b4f0f011c30/dcad02ca-a5d7-495c-8e05-7edcd9c60e08/Charlene.png?format=1000w';

const groups={
  service:new Set(['new-page','marriage-and-couples-therapy-counseling','marriagereset','teen-counseling','childrentherapy','family-therapy-group-counseling','new-page-1','new-page-2']),
  clinician:new Set(['kody-evans-bio','dr-nolan','emily-johnsrud-bio','gary-ashley','new-page-47']),
  concern:new Set(['anxiety-stress-therapy','depression-therapy','adhd-neurodivergence-therapy','trauma-therapy','grief-counseling','self-esteem-identity-therapy','relationship-issues-therapy','parenting-family-stress-therapy','life-transitions-therapy','substance-use-recovery-therapy']),
  approach:new Set(['cognitive-behavioral-therapy-cbt','dialectical-behavior-therapy-dbt','emotionally-focused-therapy-eft','gottman-method-couples-therapy','internal-family-systems-ifs','solution-focused-brief-therapy','narrative-therapy','motivational-interviewing','attachment-based-therapy','family-systems-therapy','mindfulness-based-therapy','trauma-informed-therapy']),
  resource:new Set(['how-to-start-therapy','how-to-choose-a-therapist','online-vs-in-person-therapy','therapy-insurance-benefits']),
  location:new Set(['online-therapy-spokane-wa','online-therapy-yakima-wa','online-therapy-tri-cities-wa','online-therapy-wenatchee-wa','online-therapy-vancouver-wa','online-therapy-bothell-wa','online-therapy-kirkland-wa','online-therapy-redmond-wa','online-therapy-bremerton-wa','online-therapy-fircrest-wa','online-therapy-king-county-wa','online-therapy-snohomish-county-wa','new-page-4']),
  hub:new Set(['services','what-we-help-with','therapy-approaches','resources','team','about','therapy-contact-woodinville','check-my-coverage','online-therapy-washington','online-therapy-locations'])
};

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
function slug(route){return route.replace(/^\/+|\/+$/g,'').split('/').pop()||'home'}
function typeFor(route){
  if(route==='/') return 'home';
  if(route.startsWith('/google/')) return 'ad';
  if(route.startsWith('/marriage-reset-assessment')) return 'assessment';
  const s=slug(route);
  for(const [k,set] of Object.entries(groups)) if(set.has(s)) return k;
  return 'standard';
}
function text(h,re){const m=h.match(re);return m?m[1].replace(/<[^>]+>/g,'').trim():''}
function listItems(h){return [...h.matchAll(/<li>(.*?)<\/li>/g)].map(m=>m[1].replace(/<[^>]+>/g,'').trim()).filter(Boolean).slice(0,8)}
function escapeHtml(s=''){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function cardLinks(items){return items.map(x=>'<li>'+escapeHtml(x)+'</li>').join('')}

function serviceSection(h,route){
  const items=listItems(h);
  const isMR=route==='/marriagereset/';
  return `<section class="section story-section">
    <div class="story-intro"><p class="kicker">${isMR?'A relationship pathway':'What this service can focus on'}</p><h2>${isMR?'Understand the relationship before trying to fix it.':'Therapy starts with what is happening in your life—not a preset curriculum.'}</h2><p>${isMR?'Marriage.Reset helps couples slow down recurring patterns, understand each partner’s experience, and identify the next conversation worth having.':'Your clinician will help clarify priorities, identify patterns, and choose an approach that fits your goals, age, relationships, and circumstances.'}</p></div>
    <div class="value-panel"><h3>${isMR?'Marriage.Reset can help you explore':'Common areas of focus'}</h3><ul class="value-list">${cardLinks(items)}</ul>${isMR?'<a class="button dark" href="/marriage-reset-assessment/">Start the free Marriage.Reset assessment</a>':'<a class="button dark" href="/team/">Find a clinician who fits</a>'}</div>
  </section>
  <section class="section action-band"><div><p class="kicker">Your next step</p><h2>${isMR?'Begin with assessment or couples care.':'You do not have to know the perfect therapy model before you start.'}</h2></div><div class="action-buttons"><a class="button dark" href="${CONSULT}">Free 10-minute consultation</a><a class="button outline-dark" href="/therapy-approaches/">Explore therapy approaches</a></div></section>`;
}
function clinicianSection(h){
  const items=listItems(h);
  const facts=(h.match(/<dl class="facts">[\s\S]*?<\/dl>/)||[''])[0];
  return `<section class="section clinician-story"><div class="clinician-copy"><p class="kicker">Fit matters</p><h2>What it may be like to work together.</h2><p>Use the profile to understand who this clinician works with and the concerns they commonly support. A short consultation can help you decide whether the interpersonal fit feels right before beginning ongoing care.</p>${facts}</div><div class="value-panel"><h3>Focus areas</h3><ul class="value-list">${cardLinks(items)}</ul><a class="button dark" href="${CONSULT}">Schedule a free consultation</a></div></section>`;
}
function concernSection(h){
  const items=listItems(h);
  return `<section class="section concern-layout"><div class="story-intro"><p class="kicker">Start with the experience</p><h2>You do not need a diagnosis to know something deserves attention.</h2><p>Therapy can begin with the patterns, symptoms, stressors, or relationship changes you are noticing now. A clinician can help determine what deserves deeper assessment and what kind of support fits.</p></div><div class="signal-grid">${items.map(x=>'<div><span>•</span><p>'+escapeHtml(x)+'</p></div>').join('')}</div></section>
  <section class="section action-band"><div><p class="kicker">Find the right fit</p><h2>Move from the concern to the clinician and approach.</h2></div><div class="action-buttons"><a class="button dark" href="/team/">Compare clinicians</a><a class="button outline-dark" href="/therapy-approaches/">Explore approaches</a></div></section>`;
}
function approachSection(h){
  const items=listItems(h);
  return `<section class="section approach-layout"><div class="story-intro"><p class="kicker">How this approach may be used</p><h2>A therapy model is a tool—not the whole relationship.</h2><p>Clinicians may integrate this approach when it fits their training, your goals, and the work happening in session. The quality of the therapeutic relationship and clinical judgment still matter.</p></div><div class="method-grid">${items.map((x,i)=>'<article><span>0'+(i+1)+'</span><h3>'+escapeHtml(x)+'</h3></article>').join('')}</div></section>
  <section class="section action-band"><div><p class="kicker">Choose by fit</p><h2>See which clinicians use approaches that match what you are looking for.</h2></div><div class="action-buttons"><a class="button dark" href="/team/">Meet the team</a><a class="button outline-dark" href="/what-we-help-with/">Browse concerns</a></div></section>`;
}
function locationSection(h){
  const title=text(h,/<h1>(.*?)<\/h1>/);
  return `<section class="section location-layout"><div class="story-intro"><p class="kicker">Washington telehealth</p><h2>${escapeHtml(title.replace('Online Therapy in ','Therapy access for '))}</h2><p>Marriage.Family.Therapy has one physical office in Woodinville. Location pages explain how eligible clients elsewhere in Washington can access telehealth without implying a local branch office.</p></div><div class="location-cards"><article><h3>Choose for fit</h3><p>Compare clinicians by population served, focus area, and therapy approach rather than limiting your search to driving distance.</p><a href="/team/">Meet the team →</a></article><article><h3>Meet online</h3><p>Telehealth may be available when the client is physically located in Washington and the service is clinically appropriate.</p><a href="/online-therapy-washington/">How online therapy works →</a></article><article><h3>Prefer in person?</h3><p>Our physical office is in Woodinville, Washington.</p><a href="/therapy-contact-woodinville/">Office details →</a></article></div></section>
  <section class="section action-band"><div><p class="kicker">Ready to talk?</p><h2>Start with a free 10-minute consultation.</h2></div><div class="action-buttons"><a class="button dark" href="${CONSULT}">Schedule a consultation</a><a class="button outline-dark" href="/services/">Explore services</a></div></section>`;
}
function resourceSection(h,route){
  const items=listItems(h);
  const external=route==='/resources/'?'':`<p class="source-note">These guides are educational and are not a substitute for individualized clinical advice.</p>`;
  return `<section class="section resource-layout"><div class="story-intro"><p class="kicker">Use this guide to make a decision</p><h2>Information is most useful when it helps you know what to do next.</h2><p>Use the guide to clarify your questions, compare options, and decide whether talking with a clinician would be useful.</p>${external}</div><div class="resource-steps"><ol>${items.map(x=>'<li>'+escapeHtml(x)+'</li>').join('')}</ol><div class="resource-actions"><a href="/team/">Compare clinicians</a><a href="/services/">Explore services</a><a href="${CONSULT}">Schedule a free consultation</a></div></div></section>`;
}
function standardSection(route){
  if(route==='/check-my-coverage/') return `<section class="section story-section"><div class="story-intro"><p class="kicker">Insurance without guesswork</p><h2>Benefits are specific to the clinician, service, and plan.</h2><p>We can help you understand likely benefits before care begins. Verification is not a guarantee of payment, but it gives you a clearer starting point.</p></div><div class="value-panel"><h3>Start a benefits check</h3><p>Email our support team with a request to verify benefits. Please do not send clinical details by email.</p><a class="button dark" href="${VERIFY}">Email support to verify benefits</a></div></section>`;
  if(route==='/therapy-contact-woodinville/') return `<section class="section story-section"><div class="story-intro"><p class="kicker">Contact Marriage.Family.Therapy</p><h2>Woodinville office. Washington telehealth.</h2><p>Use the option that matches what you need: schedule, ask a practical question, verify benefits, or get directions.</p></div><div class="value-panel contact-stack"><a href="${CONSULT}"><b>Schedule a free consultation</b><span>Choose a therapist and reserve a brief introduction.</span></a><a href="mailto:support@mft.care"><b>Email support</b><span>Ask a non-urgent practice question.</span></a><a href="${VERIFY}"><b>Verify benefits</b><span>Start an insurance-benefits request.</span></a></div></section>`;
  if(route==='/about/') return `<section class="section story-section"><div class="story-intro"><p class="kicker">What we are building</p><h2>A group practice with stability, choice, and thoughtful clinical care.</h2><p>Marriage.Family.Therapy brings together clinicians with different areas of focus while giving clients multiple ways to begin: consultation, diagnostic assessment, individual therapy, relationship care, family work, and statewide telehealth.</p></div><div class="value-panel"><h3>Explore the practice</h3><div class="resource-actions"><a href="/team/">Meet the team</a><a href="/services/">Explore services</a><a href="/therapy-approaches/">Explore approaches</a></div></div></section>`;
  return '';
}
function teamCharlene(h){
  return h.replace(/<div class="staff-note">[\s\S]*?<\/div>/,`<div class="staff-card">${presentation.portrait(CHARLENE,'Charlene Brister, Clinical Manager','staff')}<div><p class="kicker">Clinical operations</p><h3>Charlene Brister</h3><p><b>Clinical Manager</b></p><p>Supports client experience, clinical operations, care coordination, and practice growth so clients and clinicians have a clear path through the practice.</p></div></div>`);
}
function replaceInnerSections(h,route,type){
  if(type==='home'||type==='ad'||type==='assessment') return h;
  if(route==='/team/') return teamCharlene(h);
  let block='';
  if(type==='service') block=serviceSection(h,route);
  else if(type==='clinician') block=clinicianSection(h);
  else if(type==='concern') block=concernSection(h);
  else if(type==='approach') block=approachSection(h);
  else if(type==='location') block=locationSection(h);
  else if(type==='resource') block=resourceSection(h,route);
  else block=standardSection(route);
  if(!block) return h;
  h=h.replace(/<section class="section content-section reveal">[\s\S]*?<\/section>/,block);
  h=h.replace(/<section class="section focus-section reveal">[\s\S]*?<\/section>/,'');
  h=h.replace(/<section class="section related reveal">[\s\S]*?<\/section>/,'');
  h=h.replace(/<section class="section start-options reveal"[\s\S]*?<\/section>/,'');
  return h;
}
for(const file of walk(DIST)){
  const route=routeFor(file);
  if(route==='/404.html') continue;
  const type=typeFor(route);
  let h=fs.readFileSync(file,'utf8');
  h=h.replace('<body>','<body class="page-'+type+'">');
  h=h.replace('<a href="/resources/">Resources</a><a class="nav-action"', '<a href="/marriagereset/">Marriage.Reset</a><a href="/resources/">Resources</a><a class="nav-action"');
  h=h.replace(/<a class="nav-action" href="[^"]+">(?:Request appointment|Free consultation)<\/a>/,'<a class="nav-action" href="'+CONSULT+'">Free consultation</a>');
  h=h.replace(/<a class="button (?:primary|light)" href="https:\/\/ops\.mft\.care\/go\/book\?[^"]*">Request appointment<\/a>/g,'<a class="button primary" href="'+CONSULT+'">Free 10-minute consultation</a>');
  h=replaceInnerSections(h,route,type);
  if(!h.includes('rel="preconnect" href="https://images.squarespace-cdn.com"')) h=h.replace('</head>','<link rel="preconnect" href="https://images.squarespace-cdn.com"></head>');
  fs.writeFileSync(file,h);
}

const cssPath=path.join(DIST,'assets/styles.css');
fs.appendFileSync(cssPath,`
/* Cohesive M.F.T. page system */
body:not(.page-home):not(.page-ad) .hero{min-height:610px;background:#f4f0e7;align-items:center}
body:not(.page-home):not(.page-ad) .hero-media{left:auto;right:0;width:46%;height:100%;border-radius:30px 0 0 30px;filter:saturate(.82) contrast(.96)}
body:not(.page-home):not(.page-ad) .hero-shade{background:linear-gradient(90deg,#f4f0e7 0%,#f4f0e7 51%,rgba(244,240,231,.7) 63%,rgba(244,240,231,0) 77%)}
body:not(.page-home):not(.page-ad) .hero-copy{color:var(--ink);width:56%;max-width:none;padding-top:5rem;padding-bottom:5rem}
body:not(.page-home):not(.page-ad) .hero-summary{color:#456866}
body:not(.page-home):not(.page-ad) .hero .button.primary{background:var(--ink);color:#fff;border-color:var(--ink)}
body:not(.page-home):not(.page-ad) .hero .button.ghost{color:var(--ink);border-color:var(--ink)}
.page-concern .hero,.page-approach .hero,.page-resource .hero,.page-hub .hero{min-height:470px;background:linear-gradient(135deg,#f7f3ea,#e8f0ec)}
.page-concern .hero-media,.page-approach .hero-media,.page-resource .hero-media,.page-hub .hero-media{display:none}
.page-concern .hero-shade,.page-approach .hero-shade,.page-resource .hero-shade,.page-hub .hero-shade{display:none}
.page-concern .hero-copy,.page-approach .hero-copy,.page-resource .hero-copy,.page-hub .hero-copy{width:min(900px,100%)}
.story-section,.clinician-story,.concern-layout,.approach-layout,.location-layout,.resource-layout{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:clamp(2rem,7vw,8rem);align-items:start;background:#fff}
.story-intro{max-width:680px}.story-intro p:not(.kicker){font-size:1.08rem;color:#456866}
.value-panel{background:var(--deep);color:#fff;border-radius:24px;padding:clamp(1.5rem,4vw,3rem);box-shadow:0 20px 50px rgba(16,47,46,.11)}
.value-panel h3{font-size:1.8rem;margin-top:0}.value-list{list-style:none;padding:0;margin:1rem 0 1.5rem;border-top:1px solid rgba(255,255,255,.18)}
.value-list li{padding:.8rem 0;border-bottom:1px solid rgba(255,255,255,.18)}
.button.dark{background:var(--gold);color:var(--deep);border-color:var(--gold)}
.button.outline-dark{border-color:var(--ink);color:var(--ink)}
.action-band{display:grid;grid-template-columns:1.2fr .8fr;gap:2rem;align-items:center;background:#edf4f1;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.action-band h2{max-width:760px}.action-buttons{display:flex;gap:.75rem;flex-wrap:wrap;justify-content:flex-end}
.signal-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1rem}.signal-grid div{display:flex;gap:.7rem;align-items:flex-start;padding:1.1rem;background:#f4f0e7;border-radius:16px}.signal-grid span{color:var(--gold);font-size:1.5rem}.signal-grid p{margin:0}
.method-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1rem}.method-grid article{padding:1.3rem;background:#edf4f1;border-radius:16px}.method-grid span{font-size:.75rem;font-weight:700;letter-spacing:.12em;color:var(--teal)}.method-grid h3{margin:.45rem 0 0}
.location-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;grid-column:1/-1}.location-cards article{padding:1.4rem;background:#f4f0e7;border-radius:18px;border-top:3px solid var(--gold)}.location-cards a{font-weight:700}
.resource-steps ol{counter-reset:steps;list-style:none;padding:0;margin:0}.resource-steps li{counter-increment:steps;padding:1rem 0;border-bottom:1px solid var(--line);font-size:1.05rem}.resource-steps li:before{content:counter(steps,decimal-leading-zero);display:inline-block;width:3rem;color:var(--teal);font-weight:700}
.resource-actions{display:grid;gap:.7rem;margin-top:1.5rem}.resource-actions a,.contact-stack a{display:grid;gap:.15rem;background:#edf4f1;padding:1rem 1.1rem;border-radius:12px;text-decoration:none}.resource-actions a{font-weight:700}.contact-stack a{background:rgba(255,255,255,.08);color:#fff}.contact-stack span{color:#d7e5e1;font-size:.9rem}
.clinician-story .facts{padding:0;margin-top:1.5rem;grid-template-columns:1fr}.clinician-story .facts div{padding:1rem 0}
.staff-card{max-width:850px;grid-template-columns:180px 1fr;background:#fff;border:0;padding:1.5rem;border-radius:20px;box-shadow:0 16px 40px rgba(16,47,46,.08)}.staff-card img{width:180px;border-radius:14px}
.breadcrumbs{opacity:.7;font-size:.72rem}
.primary-nav a[href="/marriagereset/"]{color:var(--teal);font-weight:700}
@media(max-width:900px){body:not(.page-home):not(.page-ad) .hero{display:block;padding-top:0}body:not(.page-home):not(.page-ad) .hero-media{position:relative;width:100%;height:280px;border-radius:0}body:not(.page-home):not(.page-ad) .hero-shade{display:none}body:not(.page-home):not(.page-ad) .hero-copy{width:100%;padding:2.5rem 1.25rem}.story-section,.clinician-story,.concern-layout,.approach-layout,.location-layout,.resource-layout,.action-band{grid-template-columns:1fr}.action-buttons{justify-content:flex-start}.location-cards{grid-template-columns:1fr}.signal-grid,.method-grid{grid-template-columns:1fr}}
@media(max-width:600px){.staff-card{grid-template-columns:1fr}.staff-card img{width:140px}.action-buttons{display:grid}.action-buttons .button{width:100%}}
`);
console.log(JSON.stringify({designSystem:'spread',pageTypes:['service','clinician','concern','approach','location','resource','hub'],charlenePhoto:true,seoPrinciple:'shared structure, differentiated intent and copy'},null,2));
