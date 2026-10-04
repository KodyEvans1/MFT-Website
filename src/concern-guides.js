'use strict';
// Individually authored concern guides; no diagnosis, forms, or automatic approvals.
const fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../content/concern-guides');
const guides=fs.readdirSync(dir).filter(f=>f.endsWith('.json')&&f!=='sources.json').sort().map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')));
const order=['anxiety-stress-therapy','depression-therapy','adhd-neurodivergence-therapy','trauma-therapy','grief-counseling','self-esteem-identity-therapy','relationship-issues-therapy','parenting-family-stress-therapy','life-transitions-therapy','substance-use-recovery-therapy'];
function compose(g){
 for(const k of ['slug','name','title','summary','cardSummary','panel','concernTags','sources','sections','related'])if(!g[k])throw Error('Missing concern field '+k);
 if(!order.includes(g.slug)||g.slug===order[0])throw Error('Unexpected concern owner: '+g.slug);
 if(!Array.isArray(g.concernTags)||!g.concernTags.length)throw Error('Missing explicit concern mapping');
 const sections=structuredClone(g.sections);
 const faq=sections.findIndex(s=>s.type==='faq');if(faq<0)throw Error('Concern guide needs substantive questions');
 sections.splice(faq,0,
  {type:'cards',id:'related-reading',kicker:'Follow the question',title:'Keep learning, without starting over.',columns:3,items:g.related},
  {type:'clinicians',id:'clinicians',kicker:'Choose the person as well as the approach',title:'Explore relevant clinician profiles.',intro:'Connections use the focus areas recorded in practice profiles. They are not a diagnosis, a specialist credential, a guarantee of availability, or an endorsement of every treatment discussed here.'});
 const labels={'medical-safety':'Medical safety','relationship-safety':'Safety first',safety:'Safety first','care-options':'Care options','important-distinctions':'Important differences',understanding:'Understand the concern','daily-life':'Everyday experiences','worked-example':'Worked example',distinctions:'Important differences',support:'Support options','starting-point':'Getting started',questions:'Questions',clinicians:'Clinicians'};
 const jump=sections.filter(s=>labels[s.id]).map(s=>({id:s.id,label:labels[s.id]}));
 return {version:1,slug:g.slug,name:g.name,family:'concern',status:'draft',publication:'review-only',visualApproval:false,clinicalApproval:false,ownerApproval:false,contentOrigin:'authored-concern-guide',
  hero:{kicker:'By concern | '+g.name,title:g.title,summary:g.summary,actions:[{label:'Understand this concern',href:'#understanding'},{label:'Explore support',href:'#clinicians'}],panel:g.panel},
  jump,sections,clinicianRule:{concernAny:g.concernTags},sources:g.sources};
}
const pages=guides.map(compose);
if(pages.length!==9||new Set(pages.map(p=>p.slug)).size!==9)throw Error('Expected nine authored concern guides alongside unchanged anxiety');
module.exports={guides,pages,order,compose};
