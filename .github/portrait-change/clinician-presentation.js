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
  return `<div class="mft-portrait-frame mft-portrait--${variant}" data-portrait-frame data-portrait-variant="${variant}"><img${hero?' class="hero-media"':''} src="${esc(href(src))}" alt="${esc(name)}" data-portrait-fit="contain" ${hero?'fetchpriority="high"':'loading="lazy"'} referrerpolicy="no-referrer"></div>`;
}
function hero(p, actions){return `<section class="hero mft-clinician-hero" data-clinician-hero="${esc(p.slug)}"><div class="hero-copy"><p class="kicker">Meet your clinician</p>${identity(p.slug,'h1')}<p class="hero-summary">${esc(p.summary)}</p><div class="actions">${actions}</div></div>${portrait(p.image,p.name,'hero',true)}</section>`;}
module.exports={identity,portrait,hero,person};
