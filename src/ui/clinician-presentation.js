'use strict';
// Shared presentation only. Clinical credentials and scope are not inferred here.
const {esc, href}=require('./home-components');
const people=require('../../content/clinician-registry.json').clinicians;
const bySlug=new Map(people.map(p=>[p.slug,p]));
function person(slug){const p=bySlug.get(slug);if(!p)throw Error('Unknown clinician: '+slug);return p;}
function identity(slug, tag='h3') {
  if(!['h1','h2','h3','b','span'].includes(tag))throw Error('Invalid clinician heading');
  const p=person(slug);
  if(!p.license||/[,;]\s*(LMFT|LMHC|LMFTA|LMHCA|LSWAIC)\b/.test(p.name))throw Error('Name and credentials must be separate');
  return `<div class="mft-clinician-identity" data-clinician-identity="${esc(slug)}"><${tag} class="mft-clinician-name">${esc(p.name)}</${tag}><p class="mft-clinician-license">${esc(p.license)}</p><p class="mft-clinician-description">${esc(p.credential)}</p></div>`;
}
function portrait(src, name, variant='card', hero=false) {
  if(!['card','directory','hero','staff'].includes(variant))throw Error('Invalid portrait variant');
  return `<div class="mft-portrait-frame mft-portrait--${variant}" data-portrait-frame data-portrait-variant="${variant}"><img${hero?' class="hero-media"':''} src="${esc(href(src))}" alt="${esc(name)}" data-portrait-fit="cover" ${hero?'fetchpriority="high"':'loading="lazy"'} referrerpolicy="no-referrer"></div>`;
}
// Actual decoded source dimensions, not the requested CDN resize label.
// Emily and Taylor's current uploads have no larger rendition; keep their
// rendered width modest rather than pretend a 2500w query creates detail.
const heroSources = Object.freeze({
  'kody-evans-bio': {width:2500,height:1664,maxWidth:760},
  'dr-nolan': {width:561,height:628,maxWidth:400},
  'emily-johnsrud-bio': {width:512,height:641,maxWidth:380},
  'gary-ashley': {width:1254,height:1254,maxWidth:500},
  'new-page-47': {width:1891,height:2553,maxWidth:440}
});
function heroPortrait(p) {
  const source=heroSources[p.slug];
  if(!source)throw Error('Missing verified hero source dimensions: '+p.slug);
  const url=new URL(href(p.image));
  const rendition=w=>{const u=new URL(url);u.searchParams.set('format',w+'w');return u.href;};
  const widths=[500,750,1000,1500].filter(w=>w<source.width);
  const set=[...widths.map(w=>rendition(w)+' '+w+'w'),rendition(2500)+' '+source.width+'w'].join(', ');
  return `<div class="mft-portrait-frame mft-portrait--hero" data-portrait-frame data-portrait-variant="hero"><img class="hero-media" src="${esc(href(p.image))}" srcset="${esc(set)}" sizes="(max-width:600px) min(88vw, 340px), (max-width:900px) 400px, min(48vw, ${source.maxWidth}px)" width="${source.width}" height="${source.height}" alt="${esc(p.name)}" data-portrait-fit="contain" data-source-width="${source.width}" fetchpriority="high" decoding="async" referrerpolicy="no-referrer"></div>`;
}
function hero(p, actions){return `<section class="hero mft-clinician-hero" data-clinician-hero="${esc(p.slug)}" data-hero-treatment="green-blend">${heroPortrait(p)}<div class="mft-clinician-blend" aria-hidden="true"></div><div class="hero-copy"><p class="kicker">Meet your clinician</p>${identity(p.slug,'h1')}<p class="hero-summary">${esc(p.summary)}</p><div class="actions">${actions}</div></div></section>`;}
module.exports={identity,portrait,hero,person,heroSources,heroPortrait};
