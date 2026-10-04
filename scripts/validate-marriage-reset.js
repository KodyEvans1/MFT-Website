'use strict';
const fs=require('node:fs'),path=require('node:path'),mr=require('../src/marriage-reset');
const dist=path.resolve(__dirname,'../dist'),errors=[],pages=[];
for(const slug of mr.routes){
 const h=fs.readFileSync(path.join(dist,slug,'index.html'),'utf8'),main=h.match(/<main\b[^>]*>[\s\S]*?<\/main>/)?.[0]||'';
 if(!main.includes('data-mr-revision="'+mr.revision+'"'))errors.push(slug+': missing current model source');
 if(/<form\b|<input\b|<textarea\b|data-netlify=|Request free access|Start the free|request is in/i.test(main))errors.push(slug+': obsolete public enrollment');
 if(!main.includes('data-mr-client-access'))errors.push(slug+': missing separate client sign-in');
 if(mr.enabled()&&!slug.endsWith('/thanks')&&!main.includes('id="questions"'))errors.push(slug+': missing source FAQs');
 if(!mr.enabled()&&main.includes('id="the-journey"'))errors.push(slug+': unapproved detailed copy in production build');
 const ids=[...main.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
 if(ids.length!==new Set(ids).size)errors.push(slug+': duplicate anchors');
 for(const m of main.matchAll(/href="#([^"]+)"/g))if(!ids.includes(m[1]))errors.push(slug+': missing anchor '+m[1]);
 pages.push({slug,richExplanation:mr.enabled()&&!slug.endsWith('/thanks'),sourceSections:[...new Set([...main.matchAll(/data-mr-source="([^"]+)"/g)].flatMap(m=>m[1].split(' ')))]});
}
const report={version:1,revision:mr.revision,source:mr.copy.source,pages,errors,productionRelease:false,appBehaviorVerified:false};
fs.writeFileSync(path.join(dist,'reports/marriage-reset.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({marriageResetPages:pages.length,errors}));if(errors.length)process.exit(1);
