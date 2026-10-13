'use strict';
// Version before SEO snapshots protected core pages. All later templates inherit
// this stylesheet URL; no post-build rewrite of protected content is needed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
function sourceVersion(root){
 const hash=crypto.createHash('sha256');
 const inputs=['src','scripts'].flatMap(dir=>files(path.join(root,dir))).filter(f=>/\.(?:css|js|cjs)$/.test(f)).sort((a,b)=>a<b?-1:a>b?1:0);
 for(const f of inputs){const b=fs.readFileSync(f);hash.update(path.relative(root,f).split(path.sep).join('/')+'\0'+b.length+'\0');hash.update(b);}
 return hash.digest('hex').slice(0,16);
}
function apply(root){
 const version=sourceVersion(root),dist=path.join(root,'dist'),href='/assets/styles.css?v='+version;
 const pages=files(dist).filter(f=>f.endsWith('.html'));
 for(const file of pages){
  const before=fs.readFileSync(file,'utf8');let count=0;
  const after=before.replace(/<link\b(?=[^>]*\brel="stylesheet")[^>]*\bhref="\/assets\/styles\.css(?:\?v=[a-f0-9]{16})?"[^>]*>/g,tag=>{count++;return tag.replace(/href="[^"]*"/,'href="'+href+'"');});
  if(count!==1)throw Error('Expected one shared stylesheet link: '+file);
  fs.writeFileSync(file,after);
 }
 const report={version,href,corePages:pages.length,strategy:'Version all CSS and JavaScript stylesheet-generating source inputs before protected-page fingerprints; never reuse the unversioned URL for a new build.'};
 fs.mkdirSync(path.join(dist,'reports'),{recursive:true});fs.writeFileSync(path.join(dist,'reports/stylesheet-version.json'),JSON.stringify(report,null,2)+'\n');
 return report;
}
if(require.main===module)console.log(JSON.stringify(apply(path.resolve(__dirname,'..'))));
module.exports={sourceVersion,apply};
