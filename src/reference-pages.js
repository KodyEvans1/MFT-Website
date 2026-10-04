'use strict';
// Native page-family composition, separate from legacy post-generation rewrites.
const fs=require('node:fs'),path=require('node:path');
const ui=require('./ui/home-components');
const {indexingEnabled}=require('./seo-safety');
const people=require('../content/clinician-registry.json').clinicians;
const evidence=require('../content/clinician-evidence.json').clinicians;
const booking=require('../content/simplepractice-booking.json');
const crypto=require('node:crypto');
const sourceCatalog={...require('../content/reference-pages/sources.json'),...require('../content/modality-guides/sources.json')};
const modalityPages=require('./modality-guides').pages;
const pages=[require('../content/reference-pages/individual.json'),require('../content/reference-pages/anxiety.json'),require('../content/reference-pages/cbt.json')];
const allPages=[...pages,...modalityPages];
const bySlug=new Map(allPages.map(p=>[p.slug,p]));
const revision=p=>crypto.createHash('sha256').update(JSON.stringify({page:p,sources:p.sources.map(id=>sourceCatalog[id]),evidence})).digest('hex');
const sourceUrls=p=>p.sources.map(id=>sourceCatalog[id].url);
function enabled(env=process.env){return env.CONTEXT!=='production'&&!indexingEnabled(env);}
function selectedClinicians(rule){return people.filter(p=>p.status==='current'&&(!rule.population||p.populations.includes(rule.population))&&(!rule.concern||p.concerns.includes(rule.concern))&&(!rule.approach||evidence.find(e=>e.slug===p.slug)?.approaches.includes(rule.approach)));}
function profileImage(slug){const html=fs.readFileSync(path.resolve(__dirname,'../dist',slug,'index.html'),'utf8');const url=html.match(/<img class="hero-media" src="([^"]+)"/)?.[1];if(!url)throw Error('Original clinician portrait missing: '+slug);return url.replace(/&amp;/g,'&');}
function validate(p){
 if(!p||p.version!==1||p.publication!=='review-only'||p.status!=='draft'||p.visualApproval||p.clinicalApproval||p.ownerApproval)throw Error('Reference work has not been approved for publication');
 if(!['service','concern','approach'].includes(p.family))throw Error('Unknown reference family');
 const ids=new Set();
 for(const s of p.sections){if(!/^[a-z][a-z0-9-]*$/.test(s.id)||ids.has(s.id))throw Error('Invalid or duplicate reference section');if(!['story','cards','disclosures','comparison','example','steps','faq','clinicians'].includes(s.type))throw Error('Unknown reference component: '+s.type);ids.add(s.id);}
 for(const j of p.jump)if(!ids.has(j.id))throw Error('Missing reference jump target');
 for(const id of p.sources){const s=sourceCatalog[id];if(!s||!s.title||!s.publisher||!s.checkedOn)throw Error('Missing checked reference source');ui.href(s.url);}
 function visit(v){if(!v||typeof v!=='object')return;if(Array.isArray(v))return v.forEach(visit);for(const id of v.sourceIds||[])if(!p.sources.includes(id))throw Error('Undeclared reference citation: '+id);Object.values(v).forEach(visit);}
 visit(p);if(!selectedClinicians(p.clinicianRule).length&&p.contentOrigin!=='authored-modality-guide')throw Error('No supported clinician relationship');return p;
}
function clinicianSection(s,p){
 const matches=selectedClinicians(p.clinicianRule);
 if(!matches.length)return `<section class="section mft-clinicians mft-component" id="${s.id}" data-ui="clinicians">${ui.heading(s)}<div class="mft-availability-note"><h3>Ask about current services</h3><p>The recorded profile information does not establish a clinician-specific connection for this approach. This educational guide does not establish that the service is offered.</p><p><a href="/team/">Meet the team</a> or <a href="mailto:support@mft.care?subject=Therapy%20approach%20question">ask about availability or an appropriate referral</a>.</p></div></section>`;
 const cards=matches.map(person=>{
  const source=evidence.find(e=>e.slug===person.slug);if(!source||!booking.clinicians.some(c=>c.slug===person.slug))throw Error('Missing profile source or booking identity');
  const why=p.clinicianRule.approach?`This published profile names ${(p.name||"Cognitive behavioral therapy").toLowerCase()} among its approaches.`:p.clinicianRule.concern?'Anxiety is listed among this clinician\'s focus areas for adult care.':'This clinician describes working with adults. Explore the profile for their focus and style.';
  return `<article class="mft-clinician-card" data-ui="card" data-clinician="${ui.esc(person.slug)}"><div class="mft-clinician-top"><div class="mft-portrait-frame" data-portrait-frame><img src="${ui.esc(profileImage(person.slug))}" alt="${ui.esc(person.name)}" data-portrait-fit="contain" loading="lazy" referrerpolicy="no-referrer"></div><div><h3>${ui.esc(person.name)}</h3><p>${ui.esc(person.credential)}</p></div></div><div class="mft-clinician-body"><p>${ui.esc(why)}</p><a href="/${person.slug}/">Meet ${ui.esc(person.name.split(',')[0])} <span aria-hidden="true">&rarr;</span></a></div></article>`;
 }).join('');
 return `<section class="section mft-clinicians mft-component" id="${s.id}" aria-labelledby="${s.id}-title" data-ui="clinicians">${ui.heading(s)}<div class="mft-clinician-grid">${cards}</div><p class="mft-section-note">Profile descriptions were recorded October 2, 2026. Confirm current services and availability. <a href="/team/">View the full team</a>.</p></section>`;
}
function render(slug){const p=validate(bySlug.get(slug));const body=p.sections.map(s=>s.type==='clinicians'?clinicianSection(s,p):ui[s.type](s)).join('');return `<main id="main" data-reference-page="${ui.esc(slug)}" data-page-family="${p.family}"${p.contentOrigin?` data-modality-revision="${revision(p)}"`:""} data-design-system="homepage-shared-v1">${ui.hero(p.hero)}${ui.jump(p.jump)}${body}${ui.sources(Object.fromEntries(p.sources.map(id=>[id,sourceCatalog[id]])))}<aside class="mft-care-note mft-component" aria-label="Urgent support">This educational guide does not assess you or replace individualized care. For a mental health crisis in the U.S., call or text <a href="tel:988">988</a>. For a life-threatening emergency, call 911. Ordinary scheduling and support email are not crisis services.</aside></main>`;}
function applyMetadata(html,slug){
 const p=bySlug.get(slug);if(!p||p.contentOrigin!=='authored-modality-guide')return html;
 const title=p.name+' | M.F.T.',description=p.hero.summary.length>175?p.hero.summary.slice(0,172)+'...':p.hero.summary;
 let out=html.replace(/<title>.*?<\/title>/,`<title>${ui.esc(title)}</title>`)
 .replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${ui.esc(description)}">`)
 .replace(/<meta property="og:title" content="[^"]*">/,`<meta property="og:title" content="${ui.esc(title)}">`)
 .replace(/<meta property="og:description" content="[^"]*">/,`<meta property="og:description" content="${ui.esc(description)}">`);
 out=out.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/,(_,raw)=>{
  const schema=JSON.parse(raw);for(const item of schema['@graph']||[])if(item['@type']==='WebPage'){item.name=p.name;item.description=description;item.citation=sourceUrls(p);}
  return '<script type="application/ld+json">'+JSON.stringify(schema).replace(/</g,'\\u003c')+'</script>';
 });return out;
}
module.exports={enabled,has:slug=>bySlug.has(slug),get:slug=>bySlug.get(slug),render,validate,pages,allPages,modalityPages,selectedClinicians,revision,sourceUrls,applyMetadata};
