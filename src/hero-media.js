'use strict';
// Each photographic hero asset has one canonical page owner. Logos, profile cards,
// metadata, and supporting content images are not decorative hero photographs.
const fs=require('node:fs'),path=require('node:path');
const owners=new Map([
 ['0dac4deb-e22c-42de-9d48-eaf4df2628e5','therapy-contact-woodinville'],
 ['ed7383ec-060e-4649-93bb-7e71fcea4a21','kody-evans-bio'],
 ['83275db3-920a-42f3-9c8e-618474a34b52','dr-nolan'],
 ['832941fe-27a3-4b13-97d9-720a96c1bed2','emily-johnsrud-bio'],
 ['b81f7500-fa68-425b-b2a9-8b0029f1fc04','gary-ashley'],
 ['adfbbf96-f0ab-49ce-9f82-3c3a2906adc0','new-page-47']
]);
function assetKey(src){
 try {const u=new URL(src.replace(/&amp;/g,'&'),'https://www.mft.care');const m=u.pathname.match(/\/([a-f0-9-]{36})\//i);return m?m[1].toLowerCase():u.origin+decodeURIComponent(u.pathname);}catch{return null;}
}
const imagePattern=/<img\b(?=[^>]*\bclass="[^"]*\bhero-media\b)[^>]*>/g;
function apply(html,slug){
 let out=html.replace(imagePattern,tag=>{const src=tag.match(/\bsrc="([^"]+)"/)?.[1],key=assetKey(src||'');return key&&owners.get(key)===slug?tag:'';});
 // Recompose the now imageless heading, without an empty image column or shade.
 if(!/<img\b[^>]*\bclass="[^"]*\bhero-media\b/.test(out)){
  out=out.replace(/<div\b[^>]*\bclass="hero-shade"[^>]*><\/div>/g,'');
  out=out.replace(/<section class="hero">/g,'<section class="hero mft-typographic-hero">');
 }
 return out;
}
function inspect(dist){
 const files=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(d,e.name)):[path.join(d,e.name)]);
 const entries=[],errors=[],seen=new Map();
 for(const f of files(dist).filter(f=>f.endsWith('.html'))){const h=fs.readFileSync(f,'utf8'),slug=path.relative(dist,f).replace(/\\/g,'/').replace(/\/index\.html$/,'').replace(/^index\.html$/,'');for(const m of h.matchAll(imagePattern)){
  const src=m[0].match(/src="([^"]+)"/)?.[1],key=assetKey(src||'');entries.push({slug,key,src});
  if(owners.get(key)!==slug)errors.push('Unowned hero asset on '+slug);
  if(seen.has(key))errors.push('Repeated hero asset: '+seen.get(key)+' and '+slug);else seen.set(key,slug);
 }}
 return {version:1,policy:'one canonical page per photographic hero asset',heroImages:entries.length,duplicateAssets:entries.length-seen.size,entries,errors};
}
module.exports={apply,inspect,assetKey,owners};
