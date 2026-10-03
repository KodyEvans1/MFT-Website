'use strict';
const { assertSlug, STATUSES } = require('./seo-safety');
const DIRECTORY = {kind:'state',name:'Washington',slug:'online-therapy-locations',status:'existing'};
const unique = values => [...new Set(values)];
const sortName = rows => [...rows].sort((a,b) => a.name.localeCompare(b.name,'en') || a.slug.localeCompare(b.slug));
function buildGraph(geo, crosswalk, regionConfig, editorial = {pages:[]}) {
  if(crosswalk.version!==1 || regionConfig.version!==1 || String(geo.sourceVintage)!==crosswalk.sourceVintage)
    throw new Error('Geography source versions must agree');
  if(crosswalk.reviewRequired?.length) throw new Error('County crosswalk has unresolved source geometry');
  const countyRows=crosswalk.counties, memberships=crosswalk.places;
  if(!Array.isArray(countyRows)||!Array.isArray(memberships)) throw new Error('Missing county crosswalk rows');
  const sourceCounties=new Map(countyRows), byName=new Map(countyRows.map(([id,name])=>[name,id]));
  if(sourceCounties.size!==countyRows.length || byName.size!==countyRows.length || geo.counties.length!==countyRows.length)
    throw new Error('Duplicate or missing counties');
  for(const [id,name] of countyRows) if(!/^53\d{3}$/.test(id)||typeof name!=='string') throw new Error('Invalid county identity');
  const nodes=new Map(), counties=new Map(), places=new Map(), regions=new Map(), countyRegions=new Map();
  function add(e) {
    assertSlug(e.slug);
    if(nodes.has(e.slug)||!STATUSES.has(e.status)) throw new Error('Duplicate route or invalid state: '+e.slug);
    nodes.set(e.slug,e);return e;
  }
  add({...DIRECTORY});
  for(const c of geo.counties) {
    const id=byName.get(c.name);
    if(!id||counties.has(id)) throw new Error('County registry/source mismatch: '+c.name);
    counties.set(id,add({...c,geoid:id}));
  }
  for(const r of regionConfig.regions) {
    if(r.kind!=='region'||!r.key||regions.has(r.key)||!Array.isArray(r.countyGeoids)||!r.countyGeoids.length) throw new Error('Invalid region');
    regions.set(r.key,add({...r}));
    for(const id of r.countyGeoids) {
      if(!counties.has(id)||countyRegions.has(id)) throw new Error('Unknown or repeated region county: '+id);
      countyRegions.set(id,r.key);
    }
  }
  if(countyRegions.size!==counties.size) throw new Error('Every county needs one explicit browsing region');
  const cross=new Map(memberships);
  if(cross.size!==memberships.length) throw new Error('Duplicate place in crosswalk');
  for(const p of [...geo.incorporatedPlaces,...geo.censusDesignatedPlaces]) {
    const ids=cross.get(p.geoid);
    if(!/^53\d{5}$/.test(p.geoid)||places.has(p.geoid)||!Array.isArray(ids)||!ids.length||unique(ids).length!==ids.length||ids.some(id=>!counties.has(id)))
      throw new Error('Missing or invalid place county membership: '+p.geoid);
    places.set(p.geoid,add({...p,countyGeoids:[...ids].sort()}));
  }
  if(places.size!==cross.size) throw new Error('Crosswalk and registry contain different place IDs');
  const authored=new Map();
  for(const entry of editorial.pages || []) {
    if(!nodes.has(entry.slug)||authored.has(entry.slug)||entry.status!=='draft'||!Array.isArray(entry.sections)||!entry.sections.length)
      throw new Error('Invalid or duplicate editorial draft');
    for(const s of entry.sections) if(!s.heading||!Array.isArray(s.paragraphs)||!s.paragraphs.every(p=>typeof p==='string'&&p.trim())) throw new Error('Invalid editorial section');
    authored.set(entry.slug,entry);
  }
  const ownedRegions = e => e.kind==='region' ? [e] : unique((e.kind==='county'?[e.geoid]:e.countyGeoids||[]).map(id=>countyRegions.get(id))).map(key=>regions.get(key));
  const parents = e => e.kind==='region'?[nodes.get(DIRECTORY.slug)]:e.kind==='county'?ownedRegions(e):(e.countyGeoids||[]).map(id=>counties.get(id));
  const children = e => sortName(e.kind==='state'?[...regions.values()]:e.kind==='region'?e.countyGeoids.map(id=>counties.get(id)):e.kind==='county'?[...places.values()].filter(p=>p.countyGeoids.includes(e.geoid)):[]);
  const trails = e => e.kind==='state'?[[e]]:e.kind==='region'?[[DIRECTORY,e]]:e.kind==='county'?[[DIRECTORY,...ownedRegions(e),e]]:parents(e).map(c=>[DIRECTORY,...ownedRegions(c),c,e]);
  return {nodes,counties,places,regions,authored,parents,children,trails,ownedRegions,regionBasis:regionConfig.basis,crosswalk};
}
function milesBetween(a,b) {
  if(![a?.latitude,a?.longitude,b?.latitude,b?.longitude].every(Number.isFinite)) return null;
  const rad=x=>x*Math.PI/180, lat=rad(b.latitude-a.latitude),lon=rad(b.longitude-a.longitude);
  const q=Math.sin(lat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(lon/2)**2;
  return 3958.8*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,q))));
}
function nearby(graph,e,canLink=()=>true) {
  return [...graph.places.values()].filter(p=>p.geoid!==e.geoid && canLink(p))
    .map(p=>({node:p,miles:milesBetween(e,p)})).filter(p=>p.miles!==null&&p.miles>0.1)
    .sort((a,b)=>a.miles-b.miles||a.node.slug.localeCompare(b.node.slug)).slice(0,5);
}
function isAvailable(e,production,coreSlugs) { return !production||e.kind==='state'||e.status==='approved'||coreSlugs.has(e.slug); }
module.exports={buildGraph,nearby,milesBetween,isAvailable,DIRECTORY,sortName};
