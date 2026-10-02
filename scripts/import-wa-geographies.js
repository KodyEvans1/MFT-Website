const fs=require('fs');
const path=require('path');

const ROOT=path.resolve(__dirname,'..');
const OUT=path.join(ROOT,'content','wa-geography.json');
const INC='https://tigerweb.geo.census.gov/tigerwebmain/Files/acs26/tigerweb_acs26_incplace_wa.html';
const CDP='https://tigerweb.geo.census.gov/tigerwebmain/Files/acs26/tigerweb_acs26_cdp_wa.html';

function slugify(s){return s.toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function parseRows(html,kind){
  const text=html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ');
  const rows=[...text.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map(m=>m[0]);
  const out=[];
  for(const row of rows){
    const cells=[...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>m[1].replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim());
    if(cells.length<8 || cells[0]==='MTFCC') continue;
    const basename=cells[6], fullName=cells[7], geoid=cells[2];
    if(!basename || !/^53/.test(geoid||'')) continue;
    out.push({
      kind,
      name:basename,
      censusName:fullName,
      geoid,
      slug:`online-therapy-${slugify(basename)}-wa`,
      status:'draft',
      state:'WA',
      tags:['washington',kind,'telehealth'],
      source:kind==='incorporated-place'?'U.S. Census TIGERweb ACS26 incorporated places':'U.S. Census TIGERweb ACS26 census-designated places'
    });
  }
  return out;
}
async function get(url){
  const res=await fetch(url,{headers:{'user-agent':'MFT-Website geography refresh'}});
  if(!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return res.text();
}
(async()=>{
  const [incHtml,cdpHtml]=await Promise.all([get(INC),get(CDP)]);
  const geo=JSON.parse(fs.readFileSync(OUT,'utf8'));
  geo.sourceVintage='2026';
  geo.incorporatedPlaces=parseRows(incHtml,'incorporated-place');
  geo.censusDesignatedPlaces=parseRows(cdpHtml,'census-designated-place');
  const duplicateSlugs=new Map();
  for(const e of [...geo.incorporatedPlaces,...geo.censusDesignatedPlaces]){
    const prior=duplicateSlugs.get(e.slug);
    if(prior) e.slug=e.slug.replace(/-wa$/,`-${e.kind==='census-designated-place'?'cdp':'place'}-wa`);
    duplicateSlugs.set(e.slug,e);
  }
  fs.writeFileSync(OUT,JSON.stringify(geo,null,2)+'\n');
  console.log(JSON.stringify({
    counties:geo.counties.length,
    incorporatedPlaces:geo.incorporatedPlaces.length,
    censusDesignatedPlaces:geo.censusDesignatedPlaces.length,
    total:geo.counties.length+geo.incorporatedPlaces.length+geo.censusDesignatedPlaces.length
  },null,2));
})().catch(err=>{console.error(err);process.exit(1)});
