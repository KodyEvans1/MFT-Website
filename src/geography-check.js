'use strict';
const fs=require('node:fs'),path=require('node:path');
const {buildGraph}=require('./geography-graph');
const {context}=require('./geography-render');
const {indexingEnabled}=require('./seo-safety');
function validateGeography(dist) {
  const errors=[];
  try {
    const graph=buildGraph(require('../content/wa-geography.json'),require('../content/wa-county-crosswalk.json'),require('../content/wa-regions.json'),require('../content/geo-editorial.json'));
    const core=new Set(require('../content/seo-core-routes.json').slugs);
    const ctx=context(graph,process.env.CONTEXT==='production'||indexingEnabled(),core);
    for(const e of graph.nodes.values()) {
      const file=path.join(dist,e.slug,'index.html');
      if(!fs.existsSync(file)){errors.push('Missing geography node: '+e.slug);continue;}
      const h=fs.readFileSync(file,'utf8');
      const expected=[...graph.parents(e),...graph.children(e)].filter(ctx.canLink);
      for(const n of expected) if(!h.includes('href="/'+n.slug+'/"')) errors.push('Missing geography edge: '+e.slug+' -> '+n.slug);
      if(ctx.production){
        if(h.includes('data-editorial-state="draft"')) errors.push('Unapproved editorial copy in production: '+e.slug);
        for(const m of h.matchAll(/href="\/([^"?#]+)\/"/g)) {
          const node=graph.nodes.get(m[1]);
          if(node&&node.slug!==e.slug&&!ctx.canLink(node)) errors.push('Draft geography link on production page: '+e.slug+' -> '+node.slug);
        }
      }
      const raw=(h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)||[])[1];
      const breadcrumbs=(JSON.parse(raw)['@graph']||[]).filter(n=>n['@type']==='BreadcrumbList');
      if(!breadcrumbs.length) errors.push('Geography breadcrumb schema missing: '+e.slug);
      for(const b of breadcrumbs) {
        const items=b.itemListElement||[];
        if(items.some((n,i)=>n.position!==i+1)||!items.at(-1)?.item.endsWith('/'+e.slug+'/')) errors.push('Invalid geographic breadcrumb path: '+e.slug);
      }
    }
  }catch(error){errors.push('Geography validation: '+error.message);}
  return errors;
}
module.exports={validateGeography};
