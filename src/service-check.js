'use strict';
const fs=require('node:fs'),path=require('node:path');
function inspect(dist){
 const ref=require('./reference-pages'),guides=require('./service-guides'),report={version:1,reviewMode:ref.enabled(),errors:[],pages:[],approvals:0};
 for(const p of guides.pages){
  const html=fs.readFileSync(path.join(dist,p.slug,'index.html'),'utf8');
  if(report.reviewMode){
   if(!html.includes('data-service-revision=')||!html.includes('data-reference-page="'+p.slug+'"'))report.errors.push('Service not rendered: '+p.slug);
   if(/class="breadcrumbs/.test(html))report.errors.push('Visible breadcrumb: '+p.slug);
   for(const section of p.sections)if(!html.includes('id="'+section.id+'"'))report.errors.push('Missing section '+p.slug+':'+section.id);
   for(const m of html.matchAll(/<a\b[^>]*href="\/([^"#?]+)\//g))if(!fs.existsSync(path.join(dist,m[1],'index.html')))report.errors.push('Missing destination: '+m[1]);
   if(p.slug==='new-page-2'&&(!html.includes('data-retreat-inquiry')||/"@type":"(?:Offer|Event)"/.test(html)||/<(?:input|textarea|form)\b/.test(html)))report.errors.push('Unsafe retreat controls');
  }else if(html.includes('data-service-revision='))report.errors.push('Unapproved service content in production');
  report.pages.push({slug:p.slug,sections:p.sections.length,words:JSON.stringify(p.sections).split(/\s+/).length,reviewRendered:html.includes('data-service-revision=')});
 }
 return report;
}
module.exports={inspect};
