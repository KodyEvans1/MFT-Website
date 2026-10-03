'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const lib = require('../src/editorial-library');
const data = require('../content/editorial-library.json');
const evidence = require('../content/clinician-evidence.json');
const registry = require('../content/seo-registry.json');
const clinicians = require('../content/clinician-registry.json');
const coreSlugs = ['team','resources','therapy-approaches','marriagereset','online-therapy-washington','therapy-contact-woodinville','marriage-and-couples-therapy-counseling','family-therapy-group-counseling','new-page','cognitive-behavioral-therapy-cbt','dialectical-behavior-therapy-dbt','emotionally-focused-therapy-eft','solution-focused-brief-therapy','narrative-therapy','internal-family-systems-ifs','gottman-method-couples-therapy','attachment-based-therapy','family-systems-therapy','motivational-interviewing','mindfulness-based-therapy',...clinicians.clinicians.map(c=>c.slug)];
const fixture = () => ({ content: structuredClone(data), evidence: structuredClone(evidence), registry: structuredClone(registry), clinicians, coreSlugs, production: false });
const load = input => lib.createLibrary(input || fixture());
const shell = '<html><head><title>OLD</title><meta name="description" content="OLD"><meta name="robots" content="noindex,nofollow"><link rel="canonical" href="https://www.mft.care/old/"><meta property="og:title" content="OLD"><meta property="og:description" content="OLD"><meta property="og:url" content="OLD"><script type="application/ld+json">{}</script></head><body><header>KEEP NAV</header><main id="main"><section>REMOVE TEMPLATE</section><section class="section final-cta reveal">OLD</section></main><footer>KEEP FOOTER</footer></body></html>';
function approve(input, index=0, roles=['editorial','clinical','owner']) {
  const a=input.content.articles[index];a.status='approved';
  input.registry[lib.FAMILY[a.family].key].find(e=>e.slug===a.slug).status='approved';
  a.reviews=roles.map(role=>({role,by:'Synthetic test reviewer',reviewedOn:'2026-10-02',result:'approved',revisionHash:lib.digest(a,input.content,input.evidence)}));
  return a;
}
test('editorial: nine distinct unapproved articles replace existing targets',()=>{
  const c=load();assert.equal(c.articles.size,9);
  for(const family of ['modality','relationship','decision']) assert.equal([...c.articles.values()].filter(a=>a.family===family).length,3);
  assert.ok([...c.articles.values()].every(a=>a.status==='draft'&&a.reviews.length===0));
  assert.equal(new Set([...c.articles.values()].map(a=>a.searchIntent)).size,9);
});
test('editorial: sources and clinician data are not mutated by construction',()=>{
  const input=fixture(),before=JSON.stringify(input);load(input);assert.equal(JSON.stringify(input),before);
});
test('editorial: unknown, mismatched and core-owned articles fail',()=>{
  for(const mutate of [a=>a.slug='../bad',a=>a.slug='missing-route',a=>a.family='concern',a=>a.status='approved']) {
    const f=fixture();mutate(f.content.articles[0]);assert.throws(()=>load(f));
  }
  const f=fixture();f.coreSlugs=[...coreSlugs,f.content.articles[0].slug];assert.throws(()=>load(f),/ownership/);
});
test('editorial: duplicate routes and metadata overrun fail',()=>{
  const f=fixture();f.content.articles.push(f.content.articles[0]);assert.throws(()=>load(f),/ownership/);
  for(const [k,n] of [['title',71],['summary',181]]){const g=fixture();g.content.articles[0][k]='x'.repeat(n);assert.throws(()=>load(g),/metadata/);}
});
test('editorial: unsafe source IDs, protocols and invalid dates fail',()=>{
  for(const patch of [{url:'javascript:alert(1)'},{url:'https://user:pass@example.com'},{checkedOn:'2026-02-30'},{checkedOn:'2999-01-01'}]){
    const f=fixture();Object.assign(f.content.sources['person-centered'],patch);assert.throws(()=>load(f));
  }
  const f=fixture();f.content.sources['bad"id']=f.content.sources.safety;assert.throws(()=>load(f),/slug/);
});
test('editorial: explanation needs named evidence and no section can overwrite an anchor',()=>{
  for(const mutate of [s=>s.sourceIds=[],s=>s.sourceIds=['missing'],s=>s.id='main',s=>s.id='ed-source-safety']){
    const f=fixture();mutate(f.content.articles[0].sections[0]);assert.throws(()=>load(f));
  }
});
test('editorial: broken, self and duplicate reading relationships fail',()=>{
  for(const links of [['unknown-route'],['person-centered-therapy'],['team','team']]){
    const f=fixture();f.content.articles[0].relatedSlugs=links;assert.throws(()=>load(f),/relationship/);
  }
});
test('editorial: population match is not evidence of modality use',()=>{
  const f=fixture();f.content.articles[0].clinicianLinks=[{slug:'kody-evans-bio',basis:'couples'}];assert.throws(()=>load(f),/exact profile/);
  f.content.articles[0].clinicianLinks=[{slug:'kody-evans-bio',basis:'approach',approach:'person-centered-therapy'}];assert.throws(()=>load(f),/Unsupported/);
});
test('editorial: evidence must reference actual clinician and approach routes',()=>{
  for(const mutate of [e=>e.slug='unknown-person',e=>e.approaches.push('unknown-method')]){
    const f=fixture();mutate(f.evidence.clinicians[0]);assert.throws(()=>load(f));
  }
});
test('editorial: clinician duplication and unsupported multi-approach claims fail',()=>{
  const f=fixture();f.content.articles[0].clinicianLinks.push(f.content.articles[0].clinicianLinks[0]);assert.throws(()=>load(f),/Duplicate clinician/);
  const g=fixture();g.evidence.clinicians[0].multiApproachDescription=false;assert.throws(()=>load(g),/Unsupported/);
});
test('editorial: all relationship and couples guides require safety boundaries',()=>{
  for(const a of data.articles.filter(a=>a.family==='relationship'||a.slug.includes('couples'))){
    const f=fixture();f.content.articles.find(x=>x.slug===a.slug).relationshipSafety=false;assert.throws(()=>load(f),/safety/);
  }
});
test('editorial: approval requires three current revision receipts',()=>{
  for(const roles of [[],['editorial'],['editorial','clinical']]){const f=fixture();approve(f,0,roles);assert.throws(()=>load(f),/review/);}
  const f=fixture(),a=approve(f);assert.equal(load(f).articles.get(a.slug).status,'approved');
  assert.equal(data.articles[0].status,'draft');
});
test('editorial: prose, source and profile changes invalidate approval',()=>{
  for(const mutate of [f=>f.content.articles[0].sections[0].paragraphs[0]+=' Changed.',f=>f.content.sources.safety.title+=' Changed',f=>f.evidence.clinicians[0].sourceSection+=' Changed']){
    const f=fixture();approve(f);mutate(f);assert.throws(()=>load(f),/current.*review/);
  }
});
test('editorial: reviewed state needs editorial receipt and does not become indexable',()=>{
  const f=fixture(),a=approve(f,0,['editorial']);a.status='reviewed';f.registry.modalities.find(e=>e.slug===a.slug).status='reviewed';f.production=true;
  const c=load(f);assert.equal(c.canLink(a.slug),false);assert.match(lib.renderArticle(shell,c.articles.get(a.slug),c).html,/noindex/);
});
test('editorial: source fingerprints are stable against property ordering',()=>{
  const a=data.articles[0],b=Object.fromEntries(Object.entries(a).reverse());assert.equal(lib.digest(a,data,evidence),lib.digest(b,data,evidence));
});
for(const a of data.articles) test('editorial: complete rendering and source anchors for '+a.slug,()=>{
  const ctx=load(),h=lib.renderArticle(shell,ctx.articles.get(a.slug),ctx).html;
  assert.match(h,/KEEP NAV/);assert.match(h,/KEEP FOOTER/);assert.doesNotMatch(h,/REMOVE TEMPLATE|>OLD<|<form\b|<input\b/);
  assert.equal((h.match(/<h1>/g)||[]).length,1);assert.match(h,/ed-review-note/);assert.match(h,/data-spwidget-scope-global/);
  assert.equal(h.split('src="https://widget-cdn.simplepractice.com/assets/integration-1.0.js"').length,2);
  for(const s of a.sections)assert.ok(h.includes('id="'+s.id+'"'));
  const ids=[...h.matchAll(/\bid="([^"]*)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
  for(const m of h.matchAll(/href="#([^"]*)"/g))assert.ok(ids.includes(m[1]));
  const schema=JSON.parse(h.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
  assert.deepEqual(schema['@graph'].map(x=>x['@type']),['WebPage','BreadcrumbList']);
  assert.doesNotMatch(JSON.stringify(schema),/reviewedBy|aggregateRating|"author"/);
});
test('editorial: untrusted text is escaped, not injected as markup',()=>{
  const f=fixture();f.content.articles[0].sections[0].paragraphs[0]='<img src=x onerror="alert(1)">';const c=load(f);
  const h=lib.renderArticle(shell,c.articles.get(f.content.articles[0].slug),c).html;assert.match(h,/&lt;img/);assert.doesNotMatch(h,/<img src=x/);
});
test('editorial: production discovery excludes drafts and is idempotent',()=>{
  const pre=load();for(const slug of ['resources','therapy-approaches','marriagereset','gary-ashley']){
    const h=lib.augmentDiscovery(shell,slug,pre);assert.match(h,/ed-discovery/);assert.equal(lib.augmentDiscovery(h,slug,pre),h);
    assert.ok(h.indexOf('ed-discovery')<h.indexOf('class="section final-cta'));
    const f=fixture();f.production=true;assert.doesNotMatch(lib.augmentDiscovery(h,slug,load(f)),/ed-discovery/);
  }
});
test('editorial: production links include only individually approved article',()=>{
  const f=fixture(),a=approve(f);f.production=true;const c=load(f),h=lib.augmentDiscovery(shell,'therapy-approaches',c);
  assert.ok(h.includes('href="/'+a.slug+'/"'));assert.ok(!h.includes('href="/strengths-based-therapy/"'));
  assert.equal(c.canLink('team'),true);
});
test('editorial: missing page shell fails rather than appending malformed HTML',()=>{
  const c=load();assert.throws(()=>lib.renderArticle('<body>empty</body>',[...c.articles.values()][0],c),/Missing main/);
});
test('editorial: derived revision field never changes the content fingerprint',()=>{
  const c=load(),a=[...c.articles.values()][0];assert.equal(lib.digest(a,c.content,evidence),a.revisionHash);
});
