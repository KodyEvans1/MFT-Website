'use strict';
// Authored, review-only service content. Rendering uses the homepage component library.
const fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../content/service-guides');
const pages=fs.readdirSync(dir).filter(f=>f.endsWith('.json')&&f!=='sources.json').sort().map(f=>require(path.join(dir,f)));
const routes=['marriage-and-couples-therapy-counseling','childrentherapy','teen-counseling','family-therapy-group-counseling','new-page-1','new-page-2'];
if(pages.length!==routes.length||routes.some(slug=>!pages.some(p=>p.slug===slug)))throw Error('Service guide registry mismatch');
for(const p of pages){
 if(p.contentOrigin!=='authored-service-guide'||p.family!=='service'||p.status!=='draft'||p.publication!=='review-only'||p.ownerApproval||p.clinicalApproval||p.visualApproval)throw Error('Unapproved service publication');
 if(p.sections.length<7||p.sections.find(s=>s.type==='faq')?.items.length<5)throw Error('Incomplete service composition');
 if(p.slug!=='new-page-2'&&p.sections.some(s=>['pricing','inquiry'].includes(s.type)))throw Error('Retreat controls on routine service');
 if(p.slug==='new-page-2'){
  const price=p.sections.find(s=>s.type==='pricing');
  if(price?.items.length!==3||price.items.map(x=>x.price).join(',')!=='1250,2400,3900')throw Error('Unreviewed retreat pricing change');
  if(!/provisional/i.test(price.kicker)||!p.sections.some(s=>s.type==='inquiry'))throw Error('Missing retreat inquiry/provisional boundary');
  if(p.sections.some(s=>s.type==='clinicians'))throw Error('Retreat staffing not confirmed');
 }
}
module.exports={pages,routes};
