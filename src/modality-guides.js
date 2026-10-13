'use strict';
// Saved authored content, composed with the existing homepage components.
const fs = require('node:fs');
const path = require('node:path');
const dir = path.resolve(__dirname, '../content/modality-guides');
const guides = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'sources.json').sort()
  .flatMap(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
function compose(g) {
  for (const key of ['slug','name','model','example','tools','process','limits','questions','related','sources'])
    if (!g[key]) throw Error('Incomplete modality ' + g.slug + ': ' + key);
  const citations = g.sources;
  const sections = [
    {type:'story', id:'understanding', kicker:'Understanding the approach', title:g.model.title, paragraphs:g.model.paragraphs, panel:g.model.panel, sourceIds:citations},
    {type:'example', id:'worked-example', kicker:'A worked example', title:g.example.title, intro:g.example.intro, items:g.example.items, reveal:g.example.reveal, sourceIds:citations},
    {type:'disclosures', id:'in-practice', kicker:'Go a little deeper', title:g.toolsTitle, intro:g.toolsIntro, items:g.tools, columns:g.tools.length === 4 ? 2 : 3, sourceIds:citations},
    {type:'steps', id:'sessions', kicker:'Inside the work', title:g.processTitle, intro:g.processIntro, items:g.process, sourceIds:citations},
    {type:'comparison', id:'fit-and-limits', kicker:'Fit, choice and limitations', title:g.limitsTitle, items:g.limits, sourceIds:citations},
    ...(g.safety ? [{type:'story', id:'relationship-safety', kicker:'An important boundary', title:'Safety comes before joint work.', paragraphs:[g.safety], panel:{title:'Private support comes first', paragraphs:['Discuss safety and the appropriateness of shared sessions privately with a clinician.'], items:[{title:'Confidential support', text:'National Domestic Violence Hotline', href:'https://www.thehotline.org/'}]}, sourceIds:['relationship-safety']}] : []),
    {type:'cards', id:'related-reading', kicker:'Connected reading', title:'Follow the question, not just the label.', columns:3, items:g.related},
    {type:'clinicians', id:'clinicians', kicker:'People, not just methods', title:'Explore clinician connections.', intro:'A description of an approach is not a guarantee of fit, current availability, or certification. Connections below reflect the published profile information recorded by the practice.'},
    {type:'faq', id:'questions', kicker:'Your questions, answered', title:'More to know before choosing.', items:g.questions, contact:'For practical questions, [contact the support team](mailto:support@mft.care?subject=Therapy%20approach%20question). Please keep clinical details out of the initial email.'}
  ];
  const byId = new Map(sections.map(s => [s.id,s]));
  if (!Array.isArray(g.order) || g.order.length !== sections.length || new Set(g.order).size !== sections.length || g.order.some(id => !byId.has(id)))
    throw Error('Invalid modality composition order: ' + g.slug);
  return {version:1, slug:g.slug, name:g.name, family:'approach', status:'draft', publication:'review-only', visualApproval:false, clinicalApproval:false, ownerApproval:false, contentOrigin:'authored-modality-guide',
    hero:{kicker:'Therapy approaches | ' + g.name, title:g.heroTitle, summary:g.summary, actions:[{label:'See the worked example',href:'#worked-example'},{label:'Explore clinician connections',href:'#clinicians'}], panel:{kicker:'The idea to keep in mind',title:g.panelTitle,paragraphs:g.panelParagraphs,items:[{title:'Understand the approach',text:g.model.title,href:'#understanding'},{title:'Explore the work',text:g.toolsTitle,href:'#in-practice'},{title:'Consider the fit',text:g.limitsTitle,href:'#fit-and-limits'}]}},
    jump:[{id:'understanding',label:'The approach'},{id:'worked-example',label:'Worked example'},{id:'in-practice',label:'In practice'},{id:'sessions',label:'Sessions'},{id:'fit-and-limits',label:'Fit and limits'},{id:'clinicians',label:'Clinicians'},{id:'questions',label:'Questions'}],
    sections:g.order.map(id => byId.get(id)), clinicianRule:{approach:g.slug}, sources:[...new Set([...g.sources,...(g.safety?['relationship-safety']:[])])]};
}
const pages = guides.map(compose);
if (pages.length !== 31 || new Set(pages.map(p => p.slug)).size !== pages.length) throw Error('Modality catalogue must contain 31 unique saved guides');
module.exports = {guides, pages, compose};
