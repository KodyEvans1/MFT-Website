'use strict';
// A declared paragraph is a build obligation, not optional filler for a card.
const fs=require('node:fs'),path=require('node:path');
const refs=require('./reference-pages'),ui=require('./ui/home-components');
const {plain}=require('./site-experience');
const {order}=require('./concern-guides');
function validateConcernHtml(html,p){
 const errors=[],check=(ok,message)=>{if(!ok)errors.push(p.slug+': '+message);};
 const main=html.match(/<main\b[^>]*>[\s\S]*?<\/main>/)?.[0]||'';
 check(main.includes('data-reference-page="'+p.slug+'"'),'Missing native concern owner');
 check(main.includes('data-concern-revision="'+refs.revision(p)+'"'),'Stale authored content');
 check(main.includes('data-design-system="homepage-shared-v1"'),'Missing shared components');
 const text=plain(main),strings=[];
 function collect(v){if(!v||typeof v!=='object')return;if(Array.isArray(v))return v.forEach(collect);if(v.paragraphs)strings.push(...v.paragraphs);for(const k of ['title','question','teaser','intro','summary'])if(typeof v[k]==='string')strings.push(v[k]);Object.entries(v).filter(([k])=>k!=='paragraphs').forEach(([,x])=>collect(x));}
 collect({hero:p.hero,sections:p.sections});
 for(const s of strings)check(text.includes(plain(ui.rich(s))),'Missing authored text: '+s.slice(0,80));
 const ids=[...main.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 check(new Set(ids).size===ids.length,'Duplicate anchors');
 for(const m of main.matchAll(/href="#([^"]+)"/g))check(ids.includes(m[1]),'Missing anchor '+m[1]);
 for(const s of p.sections)check(ids.includes(s.id),'Missing section '+s.id);
 for(const id of p.sources)check(ids.includes('source-'+id),'Missing reference '+id);
 check(main.includes('Fictional teaching example.'),'Missing example boundary');
 check(main.includes('has not received clinical publication approval'),'Missing review boundary');
 check(main.includes('mft-solid-cards'),'Missing solid-green interactive cards');
 check(!/<form\b|<input\b|<textarea\b/.test(main),'Unexpected public data collection');
 check(!/data-experience-body=|story-section seo-entity|class="breadcrumbs"|class="hero-media"/.test(main),'Legacy composition or decorative hero');
 const expected=refs.selectedClinicians(p.clinicianRule).map(c=>c.slug).sort();
 const actual=[...main.matchAll(/data-clinician="([^"]+)"/g)].map(m=>m[1]).sort();
 check(JSON.stringify(actual)===JSON.stringify(expected),'Incorrect clinician connections');
 if(!expected.length)check(main.includes('mft-availability-note'),'Missing service availability qualification');
 for(const m of main.matchAll(/<img\b[^>]*data-portrait-fit[^>]*>/g))check(/data-portrait-fit="contain"/.test(m[0]),'Distorted portrait fit');
 try{const schema=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1]||'{}');const page=(schema['@graph']||[]).find(n=>n['@type']==='WebPage');check(JSON.stringify(page?.citation)===JSON.stringify(refs.sourceUrls(p)),'Schema citation mismatch');}catch{check(false,'Invalid page schema');}
 check(/name="robots" content="[^"]*noindex/.test(html),'Review must remain noindex');
 return errors;
}
function validateConcernSite(dist){
 const active=refs.enabled(),errors=[],entries=[];
 for(const p of refs.concernPages){const html=fs.readFileSync(path.join(dist,p.slug,'index.html'),'utf8');
  if(active)errors.push(...validateConcernHtml(html,p));else if(html.includes('data-concern-revision='))errors.push('Review-only concern leaked into production: '+p.slug);
  entries.push({slug:p.slug,revision:refs.revision(p),sections:p.sections.length,activeInBuild:active,clinicians:refs.selectedClinicians(p.clinicianRule).map(c=>c.slug),sources:refs.sourceUrls(p)});
 }
 const hub=fs.readFileSync(path.join(dist,'what-we-help-with/index.html'),'utf8');
 if(active){
  if(!hub.includes('data-concern-hub="review-only"')||!hub.includes('mft-dark-section'))errors.push('Missing native solid-green concern directory');
  const block=hub.match(/<section\b[^>]*id="concern-guides"[\s\S]*?<\/section>/)?.[0]||'';
  const actual=[...block.matchAll(/<a\b[^>]*href="\/([^"/]+)\/"/g)].map(m=>m[1]);
  if(JSON.stringify(actual)!==JSON.stringify(order))errors.push('Concern directory is not connected to all ten guides exactly once');
  if(/class="link-grid"|class="hero-media"|class="breadcrumbs"/.test(hub))errors.push('Legacy concern directory remains');
 }else if(hub.includes('data-concern-hub='))errors.push('Review-only concern directory leaked into production');
 fs.mkdirSync(path.join(dist,'reports'),{recursive:true});
 fs.writeFileSync(path.join(dist,'reports/concern-guides.json'),JSON.stringify({version:1,reviewOnly:true,authoredGuideCount:entries.length,directoryGuideCount:order.length,anxietyContentPreserved:true,entries,errors},null,2)+'\n');
 return errors;
}
module.exports={validateConcernHtml,validateConcernSite};
