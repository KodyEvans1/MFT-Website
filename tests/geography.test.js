'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildGraph,nearby,milesBetween}=require('../src/geography-graph');
const render=require('../src/geography-render');
const geo=require('../content/wa-geography.json'),cross=require('../content/wa-county-crosswalk.json'),regions=require('../content/wa-regions.json'),editorial=require('../content/geo-editorial.json');
const core=new Set(require('../content/seo-core-routes.json').slugs);
const graph=()=>buildGraph(geo,cross,regions,editorial);
const clone=o=>JSON.parse(JSON.stringify(o));
function get(g,name){return [...g.places.values()].find(p=>p.name===name);}
test('geography: complete dated crosswalk covers all current registered communities',()=>{
  const g=graph();assert.equal(g.counties.size,39);assert.equal(g.places.size,639);assert.equal(g.regions.size,8);
  assert.equal(g.crosswalk.sourceVintage,geo.sourceVintage);assert.deepEqual(g.crosswalk.reviewRequired,[]);
  assert.equal([...g.places.values()].filter(p=>p.countyGeoids.length>1).length,8);
});
for(const [name,counties] of [['Bothell',['King County','Snohomish County']],['Auburn',['King County','Pierce County']],['Coulee Dam',['Douglas County','Grant County','Okanogan County']],['Woodland',['Clark County','Cowlitz County']],['Queets',['Grays Harbor County','Jefferson County']]]) {
  test('geography: all boundary-derived parents retained for '+name,()=>{
    const g=graph(),p=get(g,name);assert.deepEqual(g.parents(p).map(c=>c.name).sort(),counties.sort());
    for(const c of g.parents(p)) assert.ok(g.children(c).some(child=>child.slug===p.slug));
  });
}
test('geography: mismatched vintage, missing, duplicate and foreign memberships fail',()=>{
  for(const mutate of [c=>c.sourceVintage='2025',c=>c.places.pop(),c=>c.places.push(c.places[0]),c=>c.places[0][1]=[],c=>c.places[0][1]=['41001'],c=>c.reviewRequired=[{geoid:'5300100'}]]) {
    const c=clone(cross);mutate(c);assert.throws(()=>buildGraph(geo,c,regions,editorial));
  }
});
test('geography: counties cannot silently disappear or appear twice in regions',()=>{
  for(const mutate of [r=>r.regions[0].countyGeoids.pop(),r=>r.regions[0].countyGeoids.push('53033'),r=>r.regions[0].countyGeoids.push('invalid')]) {
    const r=clone(regions);mutate(r);assert.throws(()=>buildGraph(geo,cross,r,editorial));
  }
});
test('geography: graph construction preserves editorial state and source registry',()=>{
  const before=JSON.stringify({geo,cross,regions,editorial});graph();assert.equal(JSON.stringify({geo,cross,regions,editorial}),before);
});
test('geography: every parent/child edge is reciprocal and trails are acyclic',()=>{
  const g=graph();for(const e of g.nodes.values()){
    for(const parent of g.parents(e)) assert.ok(g.children(parent).some(c=>c.slug===e.slug));
    for(const t of g.trails(e)) assert.equal(new Set(t.map(n=>n.slug)).size,t.length);
  }
});
test('geography: multi-county and multi-region breadcrumb paths survive independently',()=>{
  const g=graph(),ctx=render.context(g,false,core);
  const paths=render.breadcrumbSchema(get(g,'Coulee Dam'),ctx);assert.equal(paths.length,3);
  assert.equal(new Set(paths.map(p=>p['@id'])).size,3);
  for(const path of paths) assert.deepEqual(path.itemListElement.map(i=>i.position),[1,2,3,4,5]);
  const queets=render.breadcrumbSchema(get(g,'Queets'),ctx);assert.equal(queets.length,2);
  assert.notEqual(queets[0].itemListElement[2].item,queets[1].itemListElement[2].item);
});
test('geography: production navigation hides drafts without inventing replacement parents',()=>{
  const g=graph(),ctx=render.context(g,true,core),p=get(g,'Coulee Dam');
  const paths=render.breadcrumbSchema(p,ctx);assert.equal(paths.length,1);assert.equal(paths[0].itemListElement.length,3);
  const h=render.panels(p,ctx);assert.doesNotMatch(h,/data-editorial-state="draft"/);
  for(const county of g.parents(p)) assert.ok(!h.includes('href="/'+county.slug+'/"'));
});
test('geography: preview includes a six-page authored review batch; production does not',()=>{
  const g=graph(),preview=render.context(g,false,core),prod=render.context(g,true,core);assert.equal(g.authored.size,6);
  for(const slug of g.authored.keys()) {
    assert.match(render.panels(g.nodes.get(slug),preview),/data-editorial-state="draft"/);
    assert.doesNotMatch(render.panels(g.nodes.get(slug),prod),/data-editorial-state="draft"/);
  }
});
test('geography: nearby distances are finite, deterministic and exclude self',()=>{
  const g=graph(),p=get(g,'Bothell'),a=nearby(g,p);assert.equal(a.length,5);assert.deepEqual(nearby(g,p),a);
  assert.ok(a.every(x=>x.node.geoid!==p.geoid && x.miles>0));
  assert.equal(milesBetween(p,p),0);assert.equal(milesBetween({},p),null);
  assert.equal(milesBetween(p,a[0].node),milesBetween(a[0].node,p));
});
const shell='<html><head><title>OLD</title><meta name="description" content="OLD"><meta name="robots" content="noindex,nofollow"><link rel="canonical" href="https://www.mft.care/old/"><script type="application/ld+json">{"@context":"https://schema.org","@graph":[]}</script></head><body><header>Keep header</header><main id="main"><nav class="breadcrumbs"><a href="/">Old breadcrumb</a></nav><section>Keep core story</section><section class="section final-cta reveal">Keep CTA</section></main><footer>Keep footer</footer></body></html>';
test('geography: generated pages replace inherited location copy but preserve shell',()=>{
  const g=graph(),e=get(g,'Woodland'),r=render.renderLocation(shell,e,render.context(g,false,core));
  assert.match(r.html,/Keep header/);assert.match(r.html,/Keep footer/);assert.doesNotMatch(r.html,/Keep core story|OLD/);
  assert.match(r.html,/Clark County/);assert.match(r.html,/Cowlitz County/);assert.equal((r.html.match(/<h1>/g)||[]).length,1);
  assert.match(r.html,/noindex,nofollow/);assert.equal(r.description.length<180,true);
});
test('geography: deliberate core augmentation preserves existing story and is idempotent',()=>{
  const g=graph(),e=get(g,'Bothell'),ctx=render.context(g,false,core);const h=render.augmentCore(shell,e,ctx);
  assert.match(h,/Keep core story/);assert.match(h,/Keep CTA/);assert.equal(render.augmentCore(h,e,ctx),h);
});
test('geography: editorial links and unsafe slugs cannot bypass the registry',()=>{
  const ed=clone(editorial);ed.pages[0].slug='missing';assert.throws(()=>buildGraph(geo,cross,regions,ed));
  const r=clone(regions);r.regions[0].slug='../escape';assert.throws(()=>buildGraph(geo,cross,r,editorial));
});
test('geography: same-name communities get county-qualified metadata without URL changes',()=>{
  const g=graph(),ctx=render.context(g,false,core);
  for(const name of ['Clear Lake','Fairwood']) {
    const pages=[...g.places.values()].filter(e=>e.name===name).map(e=>({e,...render.renderLocation(shell,e,ctx)}));
    assert.equal(pages.length,2);assert.equal(new Set(pages.map(p=>p.title)).size,2);
    assert.equal(new Set(pages.map(p=>p.description)).size,2);
    for(const p of pages) {assert.match(p.title,/County/);assert.ok(p.html.includes('/'+p.e.slug+'/'));}
  }
});
