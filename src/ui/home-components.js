'use strict';
// The homepage and reference pages use these SAME renderers, classes and tokens.
// Content can contain plain text and explicit Markdown-style links, never raw HTML.
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function href(value) {
  if (typeof value !== 'string' || !value || /[\x00-\x20<>"']/.test(value)) throw Error('Invalid component link');
  if (/^\/(?!\/)/.test(value) || /^#[a-z0-9-]+$/.test(value)) return value;
  const u = new URL(value);
  if (!['https:','mailto:','tel:','sms:'].includes(u.protocol) || u.username || u.password) throw Error('Unsafe component link');
  return value;
}
function rich(value) {
  let at = 0, out = '';
  const text = String(value ?? '');
  for (const m of text.matchAll(/\[([^\]\n]+)\]\(([^\s)]+)\)/g)) {
    out += esc(text.slice(at,m.index)) + `<a href="${esc(href(m[2]))}">${esc(m[1])}</a>`;
    at = m.index + m[0].length;
  }
  return out + esc(text.slice(at));
}
function refs(ids = []) {
  return ids.length ? `<p class="mft-citations">Sources ${ids.map(id=>`<a href="#source-${esc(id)}" aria-label="Read source ${esc(id)}">${esc(id)}</a>`).join(' ')}</p>` : '';
}
function paragraphs(values = []) { return values.map(p=>`<p>${rich(p)}</p>`).join(''); }
function button(a, variant = 'primary') {
  if (!a) return '';
  if (!['primary','ghost','light','dark','outline-dark'].includes(variant)) throw Error('Unknown button style');
  return `<a class="button ${variant}" data-ui="button" href="${esc(href(a.href))}">${esc(a.label)}${a.arrow ? '<span aria-hidden="true"> &rarr;</span>' : ''}</a>`;
}
function heading(s) { return `<div class="section-heading">${s.kicker?`<p class="kicker">${esc(s.kicker)}</p>`:''}<h2${s.id?` id="${esc(s.id)}-title"`:''}>${esc(s.title)}</h2>${s.intro?`<p>${rich(s.intro)}</p>`:''}</div>`; }
function quickActions(items = []) { return `<div class="quick-actions" data-ui="quick-actions">${items.map(a=>`<a href="${esc(href(a.href))}"><b>${esc(a.title)}</b><span>${rich(a.text)}</span></a>`).join('')}</div>`; }
function panel(p) { return `<aside class="home-hero-panel" data-ui="panel">${p.kicker?`<p class="kicker">${esc(p.kicker)}</p>`:''}<h2>${esc(p.title)}</h2>${paragraphs(p.paragraphs || (p.text?[p.text]:[]))}${p.items?quickActions(p.items):''}${p.actions?`<div class="actions">${p.actions.map(a=>button(a,a.variant||'light')).join('')}</div>`:''}${p.note?`<p class="mft-panel-note">${rich(p.note)}</p>`:''}</aside>`; }
function hero(h) { return `<section class="home-hero mft-component" data-ui="hero"><div class="home-hero-copy"><p class="kicker">${esc(h.kicker)}</p><h1>${esc(h.title)}</h1><p class="hero-summary">${rich(h.summary)}</p><div class="actions">${(h.actions||[]).map((a,i)=>button(a,a.variant||(i?'ghost':'primary'))).join('')}</div>${h.note?`<p class="mft-hero-note">${rich(h.note)}</p>`:''}</div>${panel(h.panel)}</section>`; }
function card(c) {
  if(c.href && /\[[^\]]+\]\(/.test(c.text)) throw Error('Clickable cards cannot contain nested links');
  const inner = `${c.eyebrow?`<small>${esc(c.eyebrow)}</small>`:''}<b>${esc(c.title)}</b><span>${rich(c.text)}</span>${c.action?`<span class="mft-card-action">${esc(c.action)} <i aria-hidden="true">&rarr;</i></span>`:''}`;
  return c.href ? `<a data-ui="card" href="${esc(href(c.href))}">${inner}</a>` : `<article data-ui="card">${inner}</article>`;
}
function cards(s) { return `<section class="section home-questions mft-component ${esc(s.tone||'')}" ${s.id?`id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title"`:''} data-ui="cards">${heading(s)}<div class="question-grid ${s.columns?`mft-cols-${s.columns}`:''}">${s.items.map(card).join('')}</div>${s.note?`<p class="mft-section-note">${rich(s.note)}</p>`:''}${refs(s.sourceIds)}</section>`; }
function steps(s) { return `<section class="section home-steps mft-component ${esc(s.tone||'')}" ${s.id?`id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title"`:''} data-ui="steps">${heading(s)}<div class="step-grid ${s.items.length===4?'mft-cols-4':''}">${s.items.map((x,i)=>`<article><span aria-hidden="true">${String(i+1).padStart(2,'0')}</span><h3>${esc(x.title)}</h3>${paragraphs(x.paragraphs||(x.text?[x.text]:[]))}${x.link?`<a href="${esc(href(x.link.href))}">${esc(x.link.label)} &rarr;</a>`:''}</article>`).join('')}</div>${s.note?`<p class="mft-section-note">${rich(s.note)}</p>`:''}${refs(s.sourceIds)}</section>`; }
function faq(s) { return `<section class="section home-faq mft-component" ${s.id?`id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title"`:''} data-ui="faq">${heading(s)}<div class="faq-grid">${s.items.map((x,i)=>`<details${s.id?` id="${esc(s.id)}-${i+1}"`:''}><summary>${esc(x.question)}</summary>${paragraphs(x.paragraphs || [x.answer])}${refs(x.sourceIds)}</details>`).join('')}</div>${s.contact?`<p class="faq-contact">${rich(s.contact)}</p>`:''}</section>`; }
function story(s) { return `<section class="section mft-story mft-component ${esc(s.tone||'')}" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title" data-ui="story"><div>${heading(s)}<div class="mft-prose">${paragraphs(s.paragraphs)}${refs(s.sourceIds)}</div></div>${panel(s.panel)}</section>`; }
function disclosures(s) { return `<section class="section home-questions mft-component ${esc(s.tone||'')}" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title" data-ui="disclosures">${heading(s)}<div class="question-grid mft-cols-${s.columns||3}">${s.items.map((x,i)=>`<details class="mft-disclosure" data-ui="card"><summary><span class="mft-card-number" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><b>${esc(x.title)}</b><span>${rich(x.teaser)}</span><span class="mft-card-action">Read more <i aria-hidden="true">+</i></span></summary><div class="mft-disclosure-body">${x.example?'<p class="kicker">Illustrative example</p>':''}${paragraphs(x.paragraphs)}${x.link?`<p><a href="${esc(href(x.link.href))}">${esc(x.link.label)} &rarr;</a></p>`:''}${refs(x.sourceIds)}</div></details>`).join('')}</div>${s.note?`<p class="mft-section-note">${rich(s.note)}</p>`:''}${refs(s.sourceIds)}</section>`; }
function comparison(s) { return `<section class="section mft-comparison mft-component ${esc(s.tone||'')}" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title" data-ui="comparison">${heading(s)}<div class="mft-comparison-grid">${s.items.map(x=>`<article><h3>${esc(x.title)}</h3>${paragraphs(x.paragraphs)}${refs(x.sourceIds)}</article>`).join('')}</div>${s.note?`<p class="mft-section-note">${rich(s.note)}</p>`:''}${refs(s.sourceIds)}</section>`; }
function example(s) { return `<section class="section mft-example mft-component" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title" data-ui="example">${heading(s)}<p class="mft-example-label">Fictional teaching example. Not a diagnosis, a client story, or an assigned exercise.</p><div class="mft-example-grid">${s.items.map((x,i)=>`<article><span class="mft-card-number">${String(i+1).padStart(2,'0')}</span><h3>${esc(x.title)}</h3>${paragraphs(x.paragraphs)}</article>`).join('')}</div><details class="mft-example-reveal"><summary>${esc(s.reveal.title)}</summary><div>${paragraphs(s.reveal.paragraphs)}</div></details>${refs(s.sourceIds)}</section>`; }
function jump(items) { return `<nav class="mft-jump mft-component" aria-label="On this page" data-ui="jump"><span>In this guide</span>${items.map(x=>`<a href="#${esc(x.id)}">${esc(x.label)}</a>`).join('')}</nav>`; }
function sources(sources) { return `<section class="section mft-sources mft-component" id="sources" data-ui="sources"><h2>Sources &amp; further reading</h2><p>Background explanations use the sources below. Examples are original and fictional; practice details are separate from general education. This review version has not received clinical publication approval.</p><ol>${Object.entries(sources).map(([id,s])=>`<li id="source-${esc(id)}" tabindex="-1"><span class="mft-source-index">${esc(id)}</span> <a href="${esc(href(s.url))}" rel="noopener noreferrer">${esc(s.title)}</a><span> ${esc(s.publisher)}. Checked ${esc(s.checkedOn)}.</span></li>`).join('')}</ol></section>`; }
module.exports = {esc,href,rich,refs,paragraphs,button,heading,panel,hero,cards,steps,faq,story,disclosures,comparison,example,jump,sources,card};
