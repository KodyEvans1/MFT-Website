'use strict';
const {robotsFor,SITE} = require('./seo-safety');
const {nearby,isAvailable} = require('./geography-graph');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const href=e=>'/'+e.slug+'/';
const link=(e,label=e.name)=>`<a href="${href(e)}">${esc(label)}</a>`;
function context(graph,production,coreSlugs) {
  const canLink=e=>isAvailable(e,production,coreSlugs);
  return {graph,production,canLink};
}
function visibleTrails(e,ctx) {
  const seen=new Set();
  return ctx.graph.trails(e).map(t=>t.filter(n=>n.slug===e.slug||ctx.canLink(n))).filter(t=>{const key=t.map(n=>n.slug).join('/');if(seen.has(key))return false;seen.add(key);return true;});
}
function breadcrumbs(e,ctx) {
  return visibleTrails(e,ctx).map((trail,i)=>`<nav class="breadcrumbs geo-breadcrumbs" aria-label="Geographic path ${i+1}"><a href="/">Home</a>`+trail.map(n=>`<span aria-hidden="true">/</span>${n.slug===e.slug?`<span aria-current="page">${esc(n.name)}</span>`:link(n)}`).join('')+'</nav>').join('');
}
function breadcrumbSchema(e,ctx) {
  return visibleTrails(e,ctx).map((trail,i)=>({'@type':'BreadcrumbList','@id':SITE+href(e)+'#geographic-path-'+(i+1),itemListElement:[{name:'Home',url:SITE+'/'},...trail.map(n=>({name:n.name,url:SITE+href(n)}))].map((n,i)=>({'@type':'ListItem',position:i+1,name:n.name,item:n.url}))}));
}
function cards(rows,ctx,description) {
  const visible=rows.filter(ctx.canLink);
  if(!visible.length) return '<p>Additional reviewed location pages are being prepared. You can still compare clinicians and explore Washington online care.</p>';
  return '<ul class="geo-directory">'+visible.map(e=>`<li>${link(e)}<span>${esc(description?description(e):e.kind==='county'?'County directory':e.kind==='region'?'Browsing region':e.kind==='census-designated-place'?'Census-designated community':'City or town')}</span></li>`).join('')+'</ul>';
}
function editorial(e,ctx) {
  const draft=ctx.graph.authored.get(e.slug);
  if(!draft || (ctx.production && draft.status!=='approved')) return '';
  return '<section class="section geo-editorial" data-editorial-state="'+esc(draft.status)+'">'+draft.sections.map(s=>`<article><h2>${esc(s.heading)}</h2>${s.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}</article>`).join('')+'</section>';
}
function parentPanel(e,ctx) {
  const parents=ctx.graph.parents(e);
  if(!parents.length) return '';
  const label=e.kind==='county'?'Browse this region':e.kind==='region'?'Browse Washington':parents.length>1?'This community crosses county boundaries':'County connection';
  const detail=e.kind==='county'||e.kind==='region'?'Regions are M.F.T. browsing groups, not government boundaries or separate clinic service areas.':`${e.name} is represented in ${parents.map(p=>p.name).join(' and ')} in the January 1, 2026 Census boundary data. County membership is geography, not a statement about insurance or appointment eligibility.`;
  return `<section class="section geo-parents"><h2>${esc(label)}</h2><p>${esc(detail)}</p>${cards(parents,ctx)}</section>`;
}
function childrenPanel(e,ctx) {
  const children=ctx.graph.children(e);
  if(!children.length) return '';
  const title=e.kind==='state'?'Browse Washington by region':e.kind==='region'?'Counties in this browsing region':'Communities in this county';
  const note=e.kind==='county'?'This directory includes incorporated places and census-designated communities in the source snapshot, not every neighborhood or postal address. Cross-county places appear in each relevant directory.':ctx.graph.regionBasis;
  return `<section class="section geo-children"><h2>${esc(title)}</h2><p>${esc(note)}</p>${cards(children,ctx)}</section>`;
}
function nearbyPanel(e,ctx) {
  if(!e.geoid||e.kind==='county') return '';
  const matches=nearby(ctx.graph,e,ctx.canLink);
  if(!matches.length) return '';
  return `<section class="section geo-nearby"><h2>Other communities to explore</h2><p>Approximate straight-line distances between Census representative coordinates. These are not driving distances, travel times or claims about convenient routes.</p><ul class="geo-directory">${matches.map(({node,miles})=>`<li>${link(node)}<span>About ${Math.round(miles)} miles straight-line</span></li>`).join('')}</ul></section>`;
}
function sourcePanel() {
  return `<section class="section geo-source"><h2>About this location directory</h2><p>County connections use the U.S. Census Bureau's January 1, 2026 boundary snapshot. Places may span more than one county. M.F.T. regional groupings are editorial navigation aids. A location listing is not a local office listing or a guarantee of available care.</p><p><a href="https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2026/MapServer" rel="noopener noreferrer">Census geography source</a> <span aria-hidden="true">|</span> <a href="/therapy-contact-woodinville/">Woodinville office details</a></p></section>`;
}
function panels(e,ctx) { return editorial(e,ctx)+parentPanel(e,ctx)+childrenPanel(e,ctx)+nearbyPanel(e,ctx)+sourcePanel(); }
function placeLabel(e,ctx) {
  const duplicates=[...ctx.graph.places.values()].filter(p=>p.name===e.name);
  return duplicates.length>1 ? `${e.name}, ${ctx.graph.parents(e).map(p=>p.name).join(' and ')}` : e.name;
}
function renderLocation(template,e,ctx) {
  const name=placeLabel(e,ctx);
  const title=`Online Therapy in ${name.replace(' Washington','')} | M.F.T.`;
  const description=`Explore ${name} through Washington county and community connections. Compare online care, clinician fit and the Woodinville office.`;
  const h1=e.kind==='region'?`Online therapy: ${name}`:`Online therapy in ${name}, Washington`;
  const lead=e.kind==='region'?`Find the county or community you are looking for within our ${e.name} browsing group.`:e.kind==='county'?`Use this ${e.name} directory to explore communities and compare your next step toward care.`:`Looking for support from ${e.name}? Start with the appointment format and clinician that fit your situation.`;
  const main=`<main id="main">${breadcrumbs(e,ctx)}<section class="section geo-hero"><p class="kicker">One Woodinville office. Washington online care.</p><h1>${esc(h1)}</h1><p class="hero-summary">${esc(lead)}</p><p>Marriage.Family.Therapy has one physical office in Woodinville. This directory does not imply an office in every listed community. Ask the practice to confirm current services, appointment format and availability.</p><div class="actions"><a class="button dark" href="/team/">Compare clinicians</a><a class="button dark" href="https://marriagefamilytherapy.clientsecure.me/">Request an appointment</a></div></section>${panels(e,ctx)}<section class="section geo-care"><h2>Choose the next question that matters to you</h2><ul class="geo-directory"><li><a href="/services/">Who is seeking support?</a><span>Explore the practice's services.</span></li><li><a href="/online-therapy-washington/">How would we meet?</a><span>Review Washington online care.</span></li><li><a href="/therapy-approaches/">How does a clinician work?</a><span>Learn about approaches and confirm fit with the clinician.</span></li><li><a href="/resources/">What should I ask first?</a><span>Prepare for the starting-care conversation.</span></li></ul></section><section class="section final-cta reveal"><p class="kicker">Your next step</p><h2>A conversation can make the choice clearer.</h2><p>Ask about the right starting appointment for you before deciding.</p><div class="actions"><a class="button light" href="https://marriagefamilytherapy.clientsecure.me/">Request an appointment</a><a class="button ghost" href="/team/">Meet the team</a></div></section></main>`;
  if(title.length>70||description.length>180) throw new Error('Geography metadata exceeds limits: '+e.slug);
  let html=template.replace(/<main\b[^>]*>[\s\S]*?<\/main>/,main);
  for(const [re,value] of [[/<title>.*?<\/title>/,`<title>${esc(title)}</title>`],[/<meta name="description" content="[^"]*">/,`<meta name="description" content="${esc(description)}">`],[/<meta name="robots" content="[^"]*">/,`<meta name="robots" content="${robotsFor(e.status)}">`],[/<link rel="canonical" href="[^"]*">/,`<link rel="canonical" href="${SITE+href(e)}">`],[/<meta property="og:title" content="[^"]*">/,`<meta property="og:title" content="${esc(title)}">`],[/<meta property="og:description" content="[^"]*">/,`<meta property="og:description" content="${esc(description)}">`],[/<meta property="og:url" content="[^"]*">/,`<meta property="og:url" content="${SITE+href(e)}">`]]) html=html.replace(re,value);
  const schema={'@context':'https://schema.org','@graph':[{'@type':'WebPage','@id':SITE+href(e)+'#webpage',url:SITE+href(e),name:h1,description},...breadcrumbSchema(e,ctx)]};
  html=html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/,`<script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>`);
  return {html,title,description};
}
function augmentCore(html,e,ctx) {
  const content='<!--mft-geo:start-->'+panels(e,ctx)+'<!--mft-geo:end-->';
  if(html.includes('<!--mft-geo:start-->')) html=html.replace(/<!--mft-geo:start-->[\s\S]*?<!--mft-geo:end-->/,content);
  else if(html.includes('<section class="section final-cta reveal">')) html=html.replace('<section class="section final-cta reveal">',content+'<section class="section final-cta reveal">');
  else html=html.replace('</main>',content+'</main>');
  const nav=breadcrumbs(e,ctx);
  if(html.includes('<nav class="breadcrumbs"')) html=html.replace(/<nav class="breadcrumbs"[\s\S]*?<\/nav>/,nav);
  html=html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/,(_,raw)=>{
    const data=JSON.parse(raw); if(!Array.isArray(data['@graph'])) throw new Error('Core schema graph missing');
    data['@graph']=data['@graph'].filter(n=>n['@type']!=='BreadcrumbList').concat(breadcrumbSchema(e,ctx));
    return '<script type="application/ld+json">'+JSON.stringify(data).replace(/</g,'\\u003c')+'</script>';
  });
  return html;
}
module.exports={context,renderLocation,augmentCore,breadcrumbSchema,breadcrumbs,panels,esc};
