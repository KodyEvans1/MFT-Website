'use strict';
// Authored topic content is separate from templates and from publication approval.
const crypto = require('node:crypto');
const { assertSlug, robotsFor, SITE } = require('./seo-safety');
const { decorateHtml } = require('./booking-build');
const FAMILY = { modality: { key: 'modalities', hub: 'therapy-approaches', label: 'Therapy approaches' }, relationship: { key: 'relationshipTopics', hub: 'marriagereset', label: 'Relationship library' }, decision: { key: 'decisionGuides', hub: 'resources', label: 'Starting care' } };
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plain = html => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const stable = x => x === null || typeof x !== 'object' ? JSON.stringify(x) : Array.isArray(x) ? '[' + x.map(stable).join(',') + ']' : '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + stable(x[k])).join(',') + '}';
function digest(article, content, evidence) {
  const { status, reviews, ...body } = article;
  return crypto.createHash('sha256').update(stable({ body, sources: content.sources, policyNotes: content.policyNotes, evidence })).digest('hex');
}
function assertText(value, label) { if (typeof value !== 'string' || !value.trim()) throw new Error('Missing editorial text: ' + label); }
function assertHttps(value) { const u = new URL(value); if (u.protocol !== 'https:' || u.username || u.password) throw new Error('Invalid source URL'); }
function assertDate(value) { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value || value > new Date().toISOString().slice(0, 10)) throw new Error('Invalid review/source date'); }
function matchesClaim(profile, claim) {
  if (!profile || profile.slug !== claim.slug) return false;
  if (claim.basis === 'approach') return profile.approaches.includes(claim.approach);
  if (claim.basis === 'multi-approach') return profile.multiApproachDescription === true;
  if (claim.basis === 'couples') return profile.populations.includes('couples');
  return false;
}
function createLibrary({ content, registry, clinicians, evidence, coreSlugs = [], production = false }) {
  if (content.version !== 1 || evidence.version !== 1 || !Array.isArray(content.articles)) throw new Error('Unknown editorial schema');
  const core = new Set(coreSlugs), entities = new Map(), profiles = new Map(), people = new Map(clinicians.clinicians.map(c => [c.slug, c]));
  for (const f of Object.values(FAMILY)) for (const e of registry[f.key] || []) entities.set(e.slug, e);
  for (const key of ['concerns', 'populations']) for (const e of registry[key] || []) entities.set(e.slug, e);
  for (const s of Object.values(content.sources)) { assertText(s.title, 'source title'); assertText(s.publisher, 'publisher'); assertHttps(s.url); assertDate(s.checkedOn); }
  for (const p of evidence.clinicians) {
    assertSlug(p.slug); if (!people.has(p.slug) || profiles.has(p.slug)) throw new Error('Invalid clinician evidence identity: ' + p.slug);
    assertHttps(p.sourceUrl); assertDate(p.checkedOn); assertText(p.sourceSection, 'profile section');
    if (!Array.isArray(p.approaches) || !Array.isArray(p.populations)) throw new Error('Missing profile evidence');
    for (const slug of p.approaches) { assertSlug(slug); if (!core.has(slug) && !entities.has(slug)) throw new Error('Unknown evidence approach route: ' + slug); }
    profiles.set(p.slug, p);
  }
  const articles = new Map();
  for (const a of content.articles) {
    assertSlug(a.slug); const f = FAMILY[a.family], entity = entities.get(a.slug);
    if (!f || !(registry[f.key] || []).some(e => e.slug === a.slug) || core.has(a.slug) || articles.has(a.slug)) throw new Error('Invalid editorial ownership: ' + a.slug);
    if (!['draft', 'reviewed', 'approved'].includes(a.status) || a.status !== entity.status) throw new Error('Editorial/registry status mismatch: ' + a.slug);
    for (const k of ['title', 'summary', 'searchIntent']) assertText(a[k], k);
    if (a.title.length > 70 || a.summary.length > 180) throw new Error('Editorial metadata too long: ' + a.slug);
    if (!Array.isArray(a.sections) || a.sections.length < 3 || !Array.isArray(a.relatedSlugs) || !Array.isArray(a.clinicianLinks) || !Array.isArray(a.questions) || !a.questions.length || !Array.isArray(a.reviews)) throw new Error('Incomplete editorial article: ' + a.slug);
    const sectionIds = new Set(); let cited = 0;
    for (const s of a.sections) {
      assertSlug(s.id); if (sectionIds.has(s.id)) throw new Error('Duplicate editorial section: ' + s.id); sectionIds.add(s.id);
      assertText(s.heading, 'section heading');
      if (!['explanation', 'preparation', 'practice-policy'].includes(s.kind) || !Array.isArray(s.paragraphs) || !s.paragraphs.length || !Array.isArray(s.sourceIds)) throw new Error('Invalid editorial section');
      for (const p of s.paragraphs) assertText(p, 'paragraph');
      if (s.kind === 'explanation' && !s.sourceIds.length) throw new Error('Explanation requires a source');
      for (const id of s.sourceIds) { if (!Object.hasOwn(content.sources, id)) throw new Error('Unknown editorial source: ' + id); cited++; }
    }
    if (!cited) throw new Error('Article has no checked sources');
    for (const slug of a.relatedSlugs) { assertSlug(slug); if (slug === a.slug || (!core.has(slug) && !entities.has(slug))) throw new Error('Unknown editorial relationship: ' + slug); }
    if (new Set(a.relatedSlugs).size !== a.relatedSlugs.length) throw new Error('Duplicate editorial relationship');
    for (const c of a.clinicianLinks) {
      if (!matchesClaim(profiles.get(c.slug), c)) throw new Error('Unsupported clinician claim: ' + c.slug);
      if (a.family === 'modality' && !((c.basis === 'approach' && c.approach === a.slug) || (a.slug === 'integrative-therapy' && c.basis === 'multi-approach'))) throw new Error('Modality requires exact profile evidence');
    }
    if ((a.family === 'relationship' || /couples/.test(a.slug)) && !a.relationshipSafety) throw new Error('Relationship article requires safety boundary');
    if (a.relationshipSafety && !Object.hasOwn(content.sources, 'safety')) throw new Error('Missing safety source');
    for (const q of a.questions) assertText(q, 'question');
    const revisionHash = digest(a, content, evidence);
    const required = a.status === 'approved' ? ['editorial', 'clinical', 'owner'] : a.status === 'reviewed' ? ['editorial'] : [];
    for (const r of a.reviews) { assertDate(r.reviewedOn); assertText(r.by, 'reviewer'); if (!['editorial', 'clinical', 'owner'].includes(r.role) || r.result !== 'approved') throw new Error('Invalid review receipt'); }
    for (const role of required) if (!a.reviews.some(r => r.role === role && r.revisionHash === revisionHash)) throw new Error('Missing current ' + role + ' review: ' + a.slug);
    articles.set(a.slug, { ...a, revisionHash });
  }
  const canLink = slug => core.has(slug) || (entities.has(slug) && (!production || entities.get(slug).status === 'approved'));
  return { content, articles, entities, profiles, people, production, canLink };
}
function sourceIds(a) { return [...new Set([...a.sections.flatMap(s => s.sourceIds), ...(a.relationshipSafety ? ['safety'] : [])])]; }
function sourceLinks(ids, all) { return ids.map(id => `<a class="ed-reference" href="#ed-source-${esc(id)}" aria-label="Source ${all.indexOf(id) + 1}">[${all.indexOf(id) + 1}]</a>`).join(' '); }
function relatedLinks(a, ctx) {
  const rows = a.relatedSlugs.filter(ctx.canLink);
  if (!rows.length) return '';
  return `<nav class="ed-related" aria-label="Related reading"><h2>Choose your next question</h2><ul>${rows.map(slug => `<li><a href="/${slug}/">${esc(ctx.articles.get(slug)?.title.replace(/ \| M\.F\.T\.$/, '') || ctx.entities.get(slug)?.name || ({ team: 'Meet the team', 'new-page': 'Individual therapy', 'therapy-approaches': 'Explore therapy approaches', 'online-therapy-washington': 'Washington online care', 'therapy-contact-woodinville': 'Woodinville office details', 'marriage-and-couples-therapy-counseling': 'Couples therapy', marriagereset: 'Marriage.Reset', 'family-therapy-group-counseling': 'Family therapy' }[slug]) || slug.replace(/-/g, ' '))}</a></li>`).join('')}</ul></nav>`;
}
function clinicianCards(a, ctx) {
  if (!a.clinicianLinks.length) return '<section class="ed-clinicians"><h2>Choose the person you will work with</h2><p><a href="/team/">Compare the team</a> and ask about current services, approach and availability.</p></section>';
  return `<section class="ed-clinicians"><h2>${a.family === 'modality' ? 'Published approach connections' : 'Explore clinicians who describe couples work'}</h2><p>These links reflect practice profiles, not a guarantee of fit or availability. They do not certify a clinician in a method or mean that a clinician reviewed this article.</p><div class="ed-clinician-grid">${a.clinicianLinks.map(c => {
    const person = ctx.people.get(c.slug), evidence = ctx.profiles.get(c.slug);
    const label = c.basis === 'approach' ? 'This approach is named in the published profile.' : c.basis === 'multi-approach' ? 'The biography describes combining approaches; no separate integrative credential is asserted.' : 'The published profile describes working with couples; no topic-specific certification is asserted.';
    return `<article><h3><a href="/${c.slug}/">${esc(person.name)}</a></h3><p>${esc(label)}</p><a class="ed-evidence" href="${esc(evidence.sourceUrl)}" rel="noopener noreferrer">Published profile source</a></article>`;
  }).join('')}</div></section>`;
}
function safetyNote(a, ids) {
  if (!a.relationshipSafety) return '';
  return `<aside class="ed-safety" aria-label="Relationship safety"><h2>Safety comes before joint work</h2><p>Fear, threats or control call for private support, not a shared communication exercise. <a href="https://www.thehotline.org/" rel="noopener noreferrer">The Hotline</a> offers confidential support. ${sourceLinks(['safety'], ids)}</p></aside>`;
}
function renderArticle(template, a, ctx) {
  const f = FAMILY[a.family], ids = sourceIds(a), title = a.title.replace(/ \| M\.F\.T\.$/, '');
  const nav = `<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/${f.hub}/">${f.label}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(title)}</span></nav>`;
  const draft = a.status !== 'approved' ? '<p class="ed-review-note">Review draft. This article has not received clinical and publication approval.</p>' : '';
  const toc = `<nav class="ed-toc" aria-label="On this page"><p>On this page</p><ol>${a.sections.map(s => `<li><a href="#${s.id}">${esc(s.heading)}</a></li>`).join('')}</ol></nav>`;
  const body = a.sections.map(s => `<section id="${s.id}" class="ed-section" data-content-kind="${s.kind}"><h2>${esc(s.heading)}</h2>${s.paragraphs.map(p => `<p>${esc(p)}</p>`).join('')}${s.sourceIds.length ? `<p class="ed-section-sources">Background sources ${sourceLinks(s.sourceIds, ids)}</p>` : ''}</section>`).join('');
  const reading = Math.max(1, Math.ceil(a.sections.reduce((n, s) => n + s.paragraphs.join(' ').split(/\s+/).length, 0) / 200));
  const main = `<main id="main" class="ed-page ed-${a.family}" data-editorial-article="${a.slug}">${nav}<header class="ed-hero"><p class="kicker">${f.label}</p><h1>${esc(title)}</h1><p class="hero-summary">${esc(a.summary)}</p><p class="ed-meta">About ${reading} minutes of article reading. Educational information, not a personal assessment.</p>${draft}</header><div class="ed-layout"><aside>${toc}<section class="ed-questions"><h2>Take these questions with you</h2><ul>${a.questions.map(q => `<li>${esc(q)}</li>`).join('')}</ul><p>No answers are collected on this page.</p></section></aside><article class="ed-copy" aria-label="${esc(title)}">${body}${safetyNote(a, ids)}</article></div><div class="ed-bottom">${clinicianCards(a, ctx)}${relatedLinks(a, ctx)}<section class="ed-sources"><h2>Sources and scope</h2><p>External sources provide background. Practice-specific statements and illustrative questions are kept separate. A source check is not clinical review.</p><ol>${ids.map(id => { const s = ctx.content.sources[id]; return `<li id="ed-source-${id}"><a href="${esc(s.url)}" rel="noopener noreferrer">${esc(s.title)}</a> <span>${esc(s.publisher)}. Source checked ${s.checkedOn}.</span></li>`; }).join('')}</ol></section></div><section class="section final-cta reveal"><p class="kicker">Your next step</p><h2>Start with the question that matters to you.</h2><p>Compare clinicians or ask about the right starting appointment. A request is not a confirmed booking.</p><div class="actions"><a class="button light" href="https://marriagefamilytherapy.clientsecure.me/">Request an appointment</a><a class="button ghost" href="/team/">Meet the team</a></div></section></main>`;
  if (!/<main\b[^>]*>[\s\S]*?<\/main>/.test(template)) throw new Error('Missing main template');
  let html = template.replace(/<main\b[^>]*>[\s\S]*?<\/main>/, main);
  const url = SITE + '/' + a.slug + '/';
  for (const [re, value] of [[/<title>.*?<\/title>/, `<title>${esc(a.title)}</title>`], [/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(a.summary)}">`], [/<meta name="robots" content="[^"]*">/, `<meta name="robots" content="${robotsFor(a.status)}">`], [/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`], [/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(a.title)}">`], [/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(a.summary)}">`], [/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`]]) html = html.replace(re, value);
  // Do not manufacture author/reviewer credentials, review dates, clinical claims or ratings.
  const schema = { '@context': 'https://schema.org', '@graph': [{ '@type': 'WebPage', '@id': url + '#webpage', url, name: title, description: a.summary, citation: ids.map(id => ctx.content.sources[id].url) }, { '@type': 'BreadcrumbList', itemListElement: [{ name: 'Home', item: SITE + '/' }, { name: f.label, item: SITE + '/' + f.hub + '/' }, { name: title, item: url }].map((x, i) => ({ '@type': 'ListItem', position: i + 1, ...x })) }] };
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`);
  return { html: decorateHtml(html, '/' + a.slug + '/').html, title: a.title, description: a.summary };
}
function discoveryBlock(articles, title) {
  if (!articles.length) return '';
  return '<!--mft-editorial-discovery:start--><section class="section ed-discovery"><p class="kicker">Reading library</p><h2>' + esc(title) + '</h2><ul>' + articles.map(a => `<li><a href="/${a.slug}/">${esc(a.title.replace(/ \| M\.F\.T\.$/, ''))}</a><span>${esc(a.summary)}</span></li>`).join('') + '</ul></section><!--mft-editorial-discovery:end-->';
}
function augmentDiscovery(html, route, ctx) {
  let articles = [...ctx.articles.values()].filter(a => ctx.canLink(a.slug));
  const f = Object.entries(FAMILY).find(([, f]) => f.hub === route);
  if (f) articles = articles.filter(a => a.family === f[0]);
  else if (ctx.people.has(route)) articles = articles.filter(a => a.family === 'modality' && a.clinicianLinks.some(c => c.slug === route));
  else return html;
  const block = discoveryBlock(articles, f ? 'Explore a question in more depth' : 'Read about approaches described in this profile');
  if (html.includes('<!--mft-editorial-discovery:start-->')) return html.replace(/<!--mft-editorial-discovery:start-->[\s\S]*?<!--mft-editorial-discovery:end-->/, block);
  return html.replace('</main>', block + '</main>');
}
function report(ctx) {
  return { version: 1, batch: ctx.content.batch, articleCount: ctx.articles.size, approved: [...ctx.articles.values()].filter(a => a.status === 'approved').length, evidenceScope: ctx.content.policyNotes, articles: [...ctx.articles.values()].map(a => ({ slug: a.slug, family: a.family, status: a.status, revisionHash: a.revisionHash, articleWords: a.sections.reduce((n, s) => n + s.paragraphs.join(' ').split(/\s+/).length, 0), sources: sourceIds(a), clinicianLinks: a.clinicianLinks, requiredBeforePublication: a.status === 'approved' ? [] : ['editorial review', 'clinical review', 'owner approval', 'unchanged revision', 'passing site-wide publication checks'] })) };
}
module.exports = { createLibrary, renderArticle, augmentDiscovery, report, digest, matchesClaim, esc, plain, FAMILY };
