const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const DIST=path.join(ROOT,'dist');
const REG=JSON.parse(fs.readFileSync(path.join(ROOT,'content','seo-registry.json'),'utf8'));
const SITE='https://www.mft.care';
const GEO=JSON.parse(fs.readFileSync(path.join(ROOT,'content','wa-geography.json'),'utf8'));
const CLIN=JSON.parse(fs.readFileSync(path.join(ROOT,'content','clinician-registry.json'),'utf8'));

const familyMeta={
  modalities:{type:'modality',source:'cognitive-behavioral-therapy-cbt',hub:'/therapy-approaches/',label:'Therapy approach'},
  concerns:{type:'concern',source:'anxiety-stress-therapy',hub:'/what-we-help-with/',label:'What we help with'},
  relationshipTopics:{type:'relationship',source:'relationship-issues-therapy',hub:'/marriagereset/',label:'Relationship topic'},
  populations:{type:'population',source:'new-page',hub:'/services/',label:'Who we serve'},
  decisionGuides:{type:'decision',source:'how-to-start-therapy',hub:'/resources/',label:'Practical guide'},
  geography:{type:'location',source:'online-therapy-king-county-wa',hub:'/online-therapy-locations/',label:'Washington location'}
};
const esc=s=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const plain=s=>String(s||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
function titleCase(slug){return slug.split('-').map(w=>w? w[0].toUpperCase()+w.slice(1):w).join(' ')}
function tokens(s){return new Set(plain(s).toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>3))}
function similaritySets(A,B){if(!A.size||!B.size)return 0; let i=0; const small=A.size<=B.size?A:B, large=A.size<=B.size?B:A; for(const x of small)if(large.has(x))i++; return i/(A.size+B.size-i)}
function sourceHtml(source){
  const p=path.join(DIST,source,'index.html');
  if(!fs.existsSync(p)) throw new Error('Missing template '+p);
  return fs.readFileSync(p,'utf8');
}
const PLACE_GEO=[...(GEO.incorporatedPlaces||[]),...(GEO.censusDesignatedPlaces||[])].filter(x=>Number.isFinite(x.latitude)&&Number.isFinite(x.longitude));
const WOODINVILLE={latitude:47.7543,longitude:-122.1635};
function milesBetween(a,b){
  if(!Number.isFinite(a?.latitude)||!Number.isFinite(a?.longitude)||!Number.isFinite(b?.latitude)||!Number.isFinite(b?.longitude)) return null;
  const R=3958.8,rad=x=>x*Math.PI/180;
  const dLat=rad(b.latitude-a.latitude),dLon=rad(b.longitude-a.longitude);
  const q=Math.sin(dLat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(q));
}
function regionFor(e){
  if(!Number.isFinite(e?.longitude)||!Number.isFinite(e?.latitude)) return 'Washington State';
  const lon=e.longitude,lat=e.latitude;
  if(lon<=-123.05) return lat>=47.2?'the Olympic Peninsula and outer western Washington':'southwest and coastal Washington';
  if(lon<=-121.45) return lat>=47.9?'northwest Washington and the north Puget Sound region':lat>=46.7?'the Puget Sound and western Washington region':'southwest Washington';
  if(lon<=-119.0) return lat>=47.5?'north-central Washington':'central Washington';
  return lat>=47.5?'northeastern Washington':'eastern Washington';
}
function nearbyGeo(e){
  if(!Number.isFinite(e?.latitude)||!Number.isFinite(e?.longitude)) return [];
  return PLACE_GEO.filter(x=>x.slug!==e.slug && x.geoid!==e.geoid).map(x=>({x,d:milesBetween(e,x)})).filter(x=>Number.isFinite(x.d)&&x.d>0.1).sort((a,b)=>a.d-b.d).slice(0,5).map(({x,d})=>({...x,distanceMiles:Math.round(d)}));
}
function locationContext(e){
  const nearby=nearbyGeo(e),wood=milesBetween(e,WOODINVILLE),region=regionFor(e);
  const placeType=e.kind==='county'?'county':String(e.placeType||e.kind||'community').toLowerCase();
  return {nearby,wood,region,placeType};
}

function related(entity,all){
  const tags=new Set(entity.tags||[]);
  return all.filter(x=>x.slug!==entity.slug).map(x=>({x,score:(x.tags||[]).filter(t=>tags.has(t)).length})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.x.name.localeCompare(b.x.name)).slice(0,4).map(x=>x.x);
}
function copyFor(type,e){
  const name=e.name||titleCase(e.slug);
  if(type==='modality') return {
    h1:name,
    summary:`Learn what ${name} emphasizes, how it may be used in therapy, and how to identify clinicians whose training and style fit what you are looking for.`,
    intro:'A therapy approach is one part of care. Clinicians may integrate different methods based on training, clinical judgment, your goals, and the therapeutic relationship.',
    q1:'What does this approach focus on?',
    q2:'Who might discuss this approach with a therapist?',
    bullets:['Core ideas and goals','How sessions may be structured','Questions to ask about clinician training','Related concerns and services']
  };
  if(type==='concern') return {
    h1:`Therapy for ${name}`,
    summary:`Explore how ${name.toLowerCase()} can affect daily life, relationships, and wellbeing, and learn how therapy may help clarify a useful next step.`,
    intro:'You do not need to arrive with a diagnosis or perfect explanation. Therapy can begin with what you are noticing, what has changed, and what you want to understand or improve.',
    q1:'What might bring someone to therapy?',
    q2:'What can a first conversation help clarify?',
    bullets:['How the concern shows up day to day','Patterns that keep repeating','Impact on relationships or functioning','Goals worth exploring with a clinician']
  };
  if(type==='relationship') return {
    h1:name,
    summary:`Relationship support for couples trying to understand ${name.toLowerCase()}, recurring patterns, and the conversations that may deserve more attention.`,
    intro:'Relationship problems are rarely just about the topic on the surface. Couples therapy and Marriage.Reset are designed to help partners slow down the pattern, understand each person’s experience, and decide what to do next.',
    q1:'What may be happening underneath the conflict?',
    q2:'How can couples move from reaction to understanding?',
    bullets:['Each partner’s experience','Recurring interaction patterns','Repair and communication','When additional support may help']
  };
  if(type==='location') {
    const ctx=locationContext(e);
    const travel=Number.isFinite(ctx.wood)?(ctx.wood<=35?'For some people in this area, the Woodinville office may also be a practical in-person option.':'Telehealth can remove the need for recurring travel to the Woodinville office.'):'The Woodinville office remains the practice’s only physical location.';
    const nearbyText=ctx.nearby.length?` Nearby communities in the current Census geography include ${ctx.nearby.map(x=>x.name).join(', ')}.`:'';
    return {
      h1:`Online Therapy in ${name}, Washington`,
      summary:`Explore online therapy access for eligible clients in ${name}, part of ${ctx.region}, and compare clinicians, services, and ways to begin care.`,
      intro:`Marriage.Family.Therapy has one physical office in Woodinville. This page describes telehealth access for people in the ${name} ${ctx.placeType} and does not imply a local branch office. ${travel}${nearbyText}`,
      q1:`What are the therapy options for people in ${name}?`,
      q2:'What should you consider when choosing a therapist?',
      bullets:['Washington-based telehealth access',`Regional context: ${ctx.region}`,'Clinician fit and availability','Woodinville in-person option']
    };
  }
  if(type==='population') return {
    h1:name,
    summary:`Therapy options tailored to the developmental, relational, and practical needs of ${name.toLowerCase()} in Woodinville and through eligible Washington telehealth.`,
    intro:'Good care starts with context. Age, relationships, responsibilities, identity, development, and life stage can all shape what therapy needs to look like.',
    q1:'What should care take into account?',
    q2:'How do you choose a clinician?',
    bullets:['Life stage and context','Relevant concerns and goals','Clinician experience and fit','In-person or online preferences']
  };
  return {
    h1:name,
    summary:`A practical guide from Marriage.Family.Therapy to help you understand ${name.toLowerCase()} and make a more informed decision about care.`,
    intro:'Clear information should reduce friction, not create more of it. This guide is designed to answer a common therapy question and point you toward the next useful resource.',
    q1:'What do you need to know first?',
    q2:'What should you do next?',
    bullets:['What the term means','Questions worth asking','What may vary by clinician or plan','Where to continue exploring']
  };
}
function normalizeTag(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function clinicianMatches(type,e){
  const tags=new Set((e.tags||[]).map(normalizeTag));
  return (CLIN.clinicians||[]).map(cl=>{
    let score=0;
    const reasons=[];
    if(type==='modality' && (cl.modalities||[]).includes(e.slug)){score+=6;reasons.push('listed approach')}
    for(const p of cl.populations||[]){if(tags.has(normalizeTag(p))){score+=2;reasons.push('population')}}
    for(const q of cl.concerns||[]){if(tags.has(normalizeTag(q))){score+=3;reasons.push('focus area')}}
    if(type==='relationship' && (cl.populations||[]).includes('couples')){score+=2;reasons.push('couples')}
    return {cl,score,reasons:[...new Set(reasons)]};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.cl.name.localeCompare(b.cl.name)).slice(0,4);
}
function clinicianBlock(type,e){
  const matches=clinicianMatches(type,e);
  if(!matches.length) return '<div class="clinician-match-note"><p>No clinician match is being asserted on this draft page until the team registry supports it.</p><a href="/team/">Review the full team →</a></div>';
  return '<div class="clinician-match-grid">'+matches.map(({cl,reasons})=>`<a href="/${cl.slug}/"><b>${esc(cl.name)}</b><span>${esc(cl.credential)}</span><small>Matched from current profile data: ${esc(reasons.join(', '))}</small></a>`).join('')+'</div>';
}

function bodySection(type,e,all){
  const c=copyFor(type,e), rel=type==='location'?nearbyGeo(e):related(e,all);
  const links=rel.map(x=>`<a href="/${x.slug}/"><b>${esc(x.name)}</b><span>${type==='location'&&Number.isFinite(x.distanceMiles)?`Nearby Washington community · about ${x.distanceMiles} miles straight-line`:`Explore a related ${type==='modality'?'approach':type==='location'?'Washington service area':'topic'}.`}</span></a>`).join('');
  return `<section class="section story-section seo-entity">
    <div class="story-intro"><p class="kicker">${esc(familyMetaKey(type).label)}</p><h2>${esc(c.q1)}</h2><p>${esc(c.intro)}</p><h3>${esc(c.q2)}</h3><p>This page is part of M.F.T.’s structured care library. Content is reviewed before becoming eligible for search indexing.</p></div>
    <div class="value-panel"><h3>What this page helps you explore</h3><ul class="value-list">${c.bullets.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul><a class="button dark" href="/team/">Compare clinicians</a></div>
  </section>
  <section class="section purpose-panel"><div class="section-heading"><p class="kicker">Connected care library</p><h2>Keep exploring without starting over.</h2><p>Related pages connect concerns, therapy approaches, populations, services, clinicians, and relationship topics so you can move through the site by what matters to you.</p></div><div class="decision-grid">${links || '<a href="/services/"><b>Explore services</b><span>Find the care pathway that best matches what you need.</span></a><a href="/therapy-approaches/"><b>Explore approaches</b><span>Learn how therapy may be structured.</span></a>'}</div></section>
  <section class="section clinician-match-section"><div class="section-heading"><p class="kicker">Clinician fit</p><h2>Explore clinicians connected to this topic.</h2><p>Matches are generated only from currently structured profile information; they are not a guarantee of availability or clinical fit.</p></div>${clinicianBlock(type,e)}</section>`;
}
function familyMetaKey(type){return Object.values(familyMeta).find(x=>x.type===type)}
function minimalSchema(url,title,desc){
  return JSON.stringify({'@context':'https://schema.org','@graph':[
    {'@type':'WebPage','@id':url+'#webpage',url,name:title,description:desc,isPartOf:{'@id':SITE+'/#website'}},
    {'@type':'BreadcrumbList',itemListElement:[
      {'@type':'ListItem',position:1,name:'Home',item:SITE+'/'},
      {'@type':'ListItem',position:2,name:title,item:url}
    ]}
  ]}).replace(/</g,'\\u003c');
}
function generate(type,e,all,meta){
  const c=copyFor(type,e);
  const url=SITE+'/'+e.slug+'/';
  const title=(type==='modality'? c.h1+' Therapy in Washington | M.F.T.' : type==='location'? c.h1+' | M.F.T.' : c.h1+' | M.F.T.');
  const desc=c.summary.length>175?c.summary.slice(0,172)+'...':c.summary;
  let h=sourceHtml(meta.source);
  h=h.replace(/<title>.*?<\/title>/,`<title>${esc(title)}</title>`);
  h=h.replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${esc(desc)}">`);
  h=h.replace(/<meta name="robots" content="[^"]*">/,`<meta name="robots" content="${e.status==='approved'?'index,follow,max-image-preview:large':'noindex,nofollow'}">`);
  h=h.replace(/<link rel="canonical" href="[^"]*">/,`<link rel="canonical" href="${url}">`);
  h=h.replace(/<meta property="og:title" content="[^"]*">/,`<meta property="og:title" content="${esc(title)}">`);
  h=h.replace(/<meta property="og:description" content="[^"]*">/,`<meta property="og:description" content="${esc(desc)}">`);
  h=h.replace(/<meta property="og:url" content="[^"]*">/,`<meta property="og:url" content="${url}">`);
  h=h.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/,`<script type="application/ld+json">${minimalSchema(url,title,desc)}</script>`);
  h=h.replace(/<h1>.*?<\/h1>/,`<h1>${esc(c.h1)}</h1>`);
  h=h.replace(/<p class="hero-summary">.*?<\/p>/,`<p class="hero-summary">${esc(c.summary)}</p>`);
  h=h.replace(/<nav class="breadcrumbs"[\s\S]*?<\/nav>/,`<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="${meta.hub}">${esc(meta.label)}</a><span aria-hidden="true">/</span><a href="/${e.slug}/" aria-current="page">${esc(c.h1)}</a></nav>`);
  h=h.replace(/<section class="section story-section seo-entity">[\s\S]*?<\/section>/,'');
  h=h.replace(/<section class="section (?:story-section|concern-layout|approach-layout|resource-layout|clinician-story|location-layout)[\s\S]*?<\/section>/,bodySection(type,e,all));
  h=h.replace(/<section class="section action-band">[\s\S]*?<\/section>/,'');
  h=h.replace(/<section class="section final-cta reveal">[\s\S]*?<\/section>/,`<section class="section final-cta reveal"><p class="kicker">Next step</p><h2>Talk with someone before deciding.</h2><p>A free 10-minute phone consultation can help you ask practical questions and decide whether to continue.</p><div class="actions"><a class="button light" href="https://marriagefamilytherapy.clientsecure.me/">Schedule a free consultation</a><a class="button ghost" href="/team/">Meet the team</a></div></section>`);
  const out=path.join(DIST,e.slug,'index.html'); fs.mkdirSync(path.dirname(out),{recursive:true}); fs.writeFileSync(out,h);
  return {type,slug:e.slug,name:e.name,status:e.status,title,description:desc,wordCount:plain(h).split(/\s+/).length,html:h,tokenSet:tokens(h)};
}

const allEntities=[];
REG.geography=[
  ...(GEO.counties||[]).filter(x=>x.status!=='existing'),
  ...(GEO.incorporatedPlaces||[]),
  ...(GEO.censusDesignatedPlaces||[])
];
for(const [key,meta] of Object.entries(familyMeta)){
  const arr=REG[key]||[];
  for(const e of arr) allEntities.push({key,meta,e});
}
const byType={};
for(const x of allEntities){(byType[x.meta.type]??=[]).push(x.e)}
const generated=[];
for(const {key,meta,e} of allEntities) generated.push(generate(meta.type,e,byType[meta.type],meta));


const stylePath=path.join(DIST,'assets','styles.css');
fs.appendFileSync(stylePath,`\n.clinician-match-section{background:#fff}.clinician-match-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem;margin-top:2rem}.clinician-match-grid a,.clinician-match-note{display:grid;gap:.3rem;padding:1.25rem;background:#edf4f1;border-radius:16px;text-decoration:none}.clinician-match-grid b{font:500 1.25rem var(--serif)}.clinician-match-grid span{color:#456866}.clinician-match-grid small{color:#617b79}.clinician-match-note{max-width:720px}.seo-entity+.purpose-panel{border-top:1px solid var(--line)}@media(max-width:700px){.clinician-match-grid{grid-template-columns:1fr}}\n`);

let similarityFlagCount=0;
const similarityFlagsSample=[];
const approvedSimilarityFlags=[];
for(let i=0;i<generated.length;i++){
  for(let j=i+1;j<generated.length;j++){
    if(generated[i].type!==generated[j].type) continue;
    const s=similaritySets(generated[i].tokenSet,generated[j].tokenSet);
    if(s>=REG.strategy.similarityThreshold){
      similarityFlagCount++;
      const flag={a:generated[i].slug,b:generated[j].slug,type:generated[i].type,similarity:Number(s.toFixed(3))};
      if(generated[i].status==='approved'||generated[j].status==='approved') approvedSimilarityFlags.push(flag);
      else if(similarityFlagsSample.length<250) similarityFlagsSample.push(flag);
    }
  }
}
const counts={};
for(const g of generated){counts[g.type]=(counts[g.type]||0)+1}
const report={
  generatedDraftPages:generated.length,
  counts,
  approved:generated.filter(x=>x.status==='approved').length,
  draft:generated.filter(x=>x.status!=='approved').length,
  similarityThreshold:REG.strategy.similarityThreshold,
  similarityFlagCount,
  similarityFlagsSample,
  approvedSimilarityFlags,
  publicationRule:REG.strategy.publicationRule,
  targetIndexablePages:REG.strategy.targetIndexablePages
};
fs.mkdirSync(path.join(DIST,'reports'),{recursive:true});
fs.writeFileSync(path.join(DIST,'reports','seo-expansion.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
