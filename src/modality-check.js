'use strict';
// Validate published preview HTML against the saved authored records.
const fs=require('node:fs'),path=require('node:path');
const refs=require('./reference-pages');
const {plain}=require('./site-experience');
const readable=s=>plain(require('./ui/home-components').rich(s));
function validateModalityHtml(html,p){
 const errors=[],check=(ok,msg)=>{if(!ok)errors.push(p.slug+': '+msg);};
 const main=html.match(/<main\b[^>]*>[\s\S]*?<\/main>/)?.[0]||'';
 check(main.includes('data-reference-page="'+p.slug+'"'),'Missing native modality owner');
 check(main.includes('data-modality-revision="'+refs.revision(p)+'"'),'Stale modality revision');
 check(main.includes('data-design-system="homepage-shared-v1"'),'Missing homepage components');
 const text=plain(main),strings=[];
 function collect(v){if(!v||typeof v!=='object')return;if(Array.isArray(v))return v.forEach(collect);if(v.paragraphs)strings.push(...v.paragraphs);for(const k of ['title','question','teaser'])if(typeof v[k]==='string')strings.push(v[k]);Object.entries(v).filter(([k])=>k!=='paragraphs').forEach(([,x])=>collect(x));}
 collect({hero:p.hero,sections:p.sections});
 for(const s of strings)check(text.includes(readable(s)),'Missing authored text: '+s.slice(0,70));
 const ids=[...main.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 check(new Set(ids).size===ids.length,'Duplicate anchor');
 for(const m of main.matchAll(/href="#([^"]+)"/g))check(ids.includes(m[1]),'Missing anchor '+m[1]);
 for(const s of p.sections)check(ids.includes(s.id),'Missing section '+s.id);
 for(const id of p.sources)check(ids.includes('source-'+id),'Missing source '+id);
 check(main.includes('Fictional teaching example.'),'Missing fictional-example boundary');
 check(main.includes('has not received clinical publication approval'),'Missing review boundary');
 check(!/<form\b|<input\b|<textarea\b/.test(main),'Unexpected public data entry');
 check(!/data-experience-body=|story-section seo-entity|class="breadcrumbs"/.test(main),'Legacy composition');
 const expected=refs.selectedClinicians(p.clinicianRule).map(c=>c.slug).sort();
 const actual=[...main.matchAll(/data-clinician="([^"]+)"/g)].map(m=>m[1]).sort();
 check(JSON.stringify(actual)===JSON.stringify(expected),'Incorrect clinician connections');
 if(!expected.length)check(main.includes('mft-availability-note'),'Missing availability boundary');
 for(const m of main.matchAll(/<img\b[^>]*data-portrait-fit[^>]*>/g)){check(/data-portrait-fit="contain"/.test(m[0]),'Portrait fit');check(!/\b(?:width|height)="/.test(m[0]),'Forced image dimensions');}
 const schema=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1]||'{}');
 const page=(schema['@graph']||[]).find(n=>n['@type']==='WebPage');
 check(JSON.stringify(page?.citation)===JSON.stringify(refs.sourceUrls(p)),'Schema source mismatch');
 check(/name="robots" content="[^"]*noindex/.test(html),'Preview must not be indexable');
 return errors;
}
function validateModalitySite(dist){
 const active=refs.enabled(),errors=[],entries=[];
 for(const p of refs.modalityPages){
  const h=fs.readFileSync(path.join(dist,p.slug,'index.html'),'utf8');
  if(active)errors.push(...validateModalityHtml(h,p));
  else if(h.includes('data-modality-revision='))errors.push(p.slug+': review-only content in production');
  entries.push({slug:p.slug,revision:refs.revision(p),activeInBuild:active,sourceUrls:refs.sourceUrls(p),clinicians:refs.selectedClinicians(p.clinicianRule).map(c=>c.slug)});
 }
 fs.mkdirSync(path.join(dist,'reports'),{recursive:true});
 fs.writeFileSync(path.join(dist,'reports/modality-guides.json'),JSON.stringify({version:1,guideCount:entries.length,reviewOnly:true,entries,errors},null,2)+'\n');
 return errors;
}
module.exports={validateModalityHtml,validateModalitySite};
