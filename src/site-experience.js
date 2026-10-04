'use strict';
// Shared user-requested presentation rules. Approval, clinical scope and URL ownership stay separate.
const fs = require('node:fs');
const path = require('node:path');
const config = require('../content/site-experience.json');
const evidence = require('../content/clinician-evidence.json');
const booking = require('./booking-build');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain = h => String(h || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
const field = (h,re) => plain(h.match(re)?.[1] || '');
const normalize = s => plain(s).toLowerCase().replace(/[\u2018\u2019]/g,"'").replace(/[\u2013\u2014]/g,'-').replace(/\s+/g,' ').trim();
const ALIASES = {
  'team':['clinician profiles','team profiles','clinician biographies','Meet the team'],
  'therapy-approaches':['therapy approaches library','therapy approaches','approaches library'],
  'services':['Explore services'],
  'online-therapy-washington':['Washington online-care page','Washington online care'],
  'therapy-contact-woodinville':['office details'],
  'check-my-coverage':['Verify benefits'],
  'new-page':['Individual therapy','Individual care'],
  'marriage-and-couples-therapy-counseling':['Couples therapy','Marriage counseling','Marriage and couples therapy'],
  'childrentherapy':['Child therapy','Children\'s therapy'],
  'teen-counseling':['Teen counseling','Teen therapy'],
  'family-therapy-group-counseling':['Family therapy','Family care'],
  'new-page-1':['Premarital counseling'],
  'marriagereset':['Marriage.Reset'],
  'anxiety-stress-therapy':['Anxiety and stress','Anxiety and worry','Anxiety and overthinking','Anxiety','Persistent worry','Overthinking','Stress management'],
  'depression-therapy':['Depression and mood','Depression','Low mood','Reduced motivation'],
  'grief-counseling':['Grief and loss','Grief','Bereavement','Ambiguous loss'],
  'adhd-neurodivergence-therapy':['ADHD and neurodivergence','ADHD and focus','ADHD','Attention and focus'],
  'trauma-therapy':['Trauma and difficult experiences','Trauma and PTSD','Trauma recovery','Trauma'],
  'self-esteem-identity-therapy':['Self-esteem and growth','Identity and self-esteem','Self-esteem','Self-criticism','Identity questions','Body image','Personal growth'],
  'relationship-issues-therapy':['Couples and relationship issues','Relationship issues','Relationship concerns','Relationship patterns','Relationship challenges'],
  'parenting-family-stress-therapy':['Parenting and family stress','Parenting concerns','Parenting stress','Family stress','Family conflict','Family communication','Parenting'],
  'life-transitions-therapy':['Life transitions','Family transitions','Changing roles','Career changes','Relationship changes','Relocation','Emotional adjustment'],
  'repeated-conflict':['Repeated conflict','Conflict cycles','Conflict and repair','Recurring conflict'],
  'emotional-distance':['Emotional distance','Emotional connection'],
  'repair-after-conflict':['Repair after conflict','Conflict resolution'],
  'cognitive-behavioral-therapy-cbt':['Cognitive behavioral therapy','Cognitive-behavioral therapy','CBT'],
  'dialectical-behavior-therapy-dbt':['Dialectical behavior therapy','DBT skills','DBT'],
  'emotionally-focused-therapy-eft':['Emotionally focused therapy','EFT'],
  'gottman-method-couples-therapy':['Gottman-informed therapy','Gottman-informed','Gottman method'],
  'internal-family-systems-ifs':['Internal family systems','IFS-informed'],
  'solution-focused-brief-therapy':['Solution-focused brief therapy','Solution focused brief therapy'],
  'family-systems-therapy':['Family systems therapy','Family systems'],
  'person-centered-therapy':['Person-centered therapy','Person-centred therapy'],
  'strengths-based-therapy':['Strengths-based therapy'],
  'integrative-therapy':['Integrative therapy'],
  'attachment-based-therapy':['Attachment-based therapy'],
  'narrative-therapy':['Narrative therapy'],
  'motivational-interviewing':['Motivational interviewing'],
  'mindfulness-based-therapy':['Mindfulness-based therapy'],
  'trauma-informed-therapy':['Trauma-informed therapy','Trauma-informed care'],
  'how-to-start-therapy':['Starting-care guide','How to start therapy'],
  'how-to-choose-a-therapist':['How to choose a therapist','Clinician-selection guide'],
  'therapy-insurance-benefits':['Therapy insurance benefits'],
  'what-happens-first-therapy-session':['First-session guide','First therapy session'],
  'what-happens-in-couples-therapy':['Couples starting guide','What happens in couples therapy'],
  'online-vs-in-person-couples-therapy':['Online versus in-person couples therapy'],
  'burnout-therapy':['Stress and burnout','Burnout'],
  'school-stress-therapy':['School pressure','School stress'],
  'friendship-stress-therapy':['Friendship challenges','Friendship difficulties'],
  'co-parenting-counseling':['Co-parenting','Co-parenting stress'],
  'blended-family-therapy':['Blended families'],
  'caregiver-stress-therapy':['Caregiver stress'],
  'chronic-pain-adjustment-therapy':['Chronic pain'],
  'sex-therapy':['Intimacy and sex therapy','Sex therapy'],
  'men-mental-health-therapy':['Men\'s issues'],
  'divorce-adjustment-therapy':['Divorce'],
  'discernment-counseling':['Discernment counseling'],
  'emotion-regulation-skills':['Emotional regulation','Emotion regulation']
};
function createContext(dist, registry, production = false) {
  const catalog = new Map();
  for (const dir of fs.readdirSync(dist,{withFileTypes:true})) {
    if (!dir.isDirectory()) continue;
    const f=path.join(dist,dir.name,'index.html'); if(!fs.existsSync(f)) continue;
    const html=fs.readFileSync(f,'utf8');
    catalog.set(dir.name,{slug:dir.name,core:true,name:field(html,/<h1\b[^>]*>([\s\S]*?)<\/h1>/),summary:field(html,/<p class="hero-summary">([\s\S]*?)<\/p>/),html});
  }
  for(const key of ['modalities','concerns','relationshipTopics','populations','decisionGuides']) for(const e of registry[key]||[]) catalog.set(e.slug,{...catalog.get(e.slug),...e,core:false,family:key,summary:''});
  for(const a of require('../content/editorial-library.json').articles) if(catalog.has(a.slug)) Object.assign(catalog.get(a.slug),{name:a.title.replace(/ \| M\.F\.T\.$/,''),summary:a.summary});
  const canLink = slug => catalog.has(slug) && (!production || catalog.get(slug).core || catalog.get(slug).status==='approved');
  for(const [slug,entry] of Object.entries(config.pages)) for(const target of entry.topics) if(!catalog.has(target)) throw Error('Unknown page-experience destination: '+slug+' -> '+target);
  const aliases=Object.entries(ALIASES).flatMap(([slug,values])=>values.map(label=>({slug,label}))).filter(a=>catalog.has(a.slug)).sort((a,b)=>b.label.length-a.label.length);
  return {catalog,canLink,aliases,production,report:new Map()};
}
function targetsFor(text,ctx,current) {
  const value=normalize(text);const found=[];
  for(const a of ctx.aliases){const p=normalize(a.label),at=value.indexOf(p);if(at<0||/[a-z0-9]/.test(value[at-1]||'')||/[a-z0-9]/.test(value[at+p.length]||''))continue;
    if(a.slug!==current&&ctx.canLink(a.slug)&&!found.includes(a.slug))found.push(a.slug);
  }return found;
}
function cards(targets,ctx,current,limit=8) {
  return [...new Set(targets)].filter(s=>s!==current&&ctx.canLink(s)).slice(0,limit).map(slug=>{
    const e=ctx.catalog.get(slug), summary=e.summary || `Read the ${e.name.toLowerCase()} draft and its related topics.`;
    return `<a class="experience-topic" data-linked-topic="${slug}" href="/${slug}/"><span class="experience-topic-title">${esc(e.name)}</span><span class="experience-topic-description">${esc(summary)}</span><span class="experience-topic-action">Read more <span aria-hidden="true">&rarr;</span></span>${!e.core&&e.status!=='approved'?'<small class="experience-status">Review draft</small>':''}</a>`;
  }).join('');
}
function peopleCards(slugs,ctx) {
  const people=require('../content/clinician-registry.json').clinicians;
  return slugs.map(slug=>people.find(p=>p.slug===slug)).filter(Boolean).map(p=>`<a class="experience-topic" data-linked-topic="${p.slug}" href="/${p.slug}/"><span class="experience-topic-title">${esc(p.name)}</span><span class="experience-topic-description">${esc(p.credential)}</span><span class="experience-topic-action">Read the profile <span aria-hidden="true">&rarr;</span></span></a>`).join('');
}
function detailBody(html,slug,ctx) {
  if(html.includes('data-experience-body='))return html;
  const entry=config.pages[slug], approach=config.approachPrompts[slug], person=evidence.clinicians.find(p=>p.slug===slug);
  if(!entry&&!approach&&!person)return html;
  const page=ctx.catalog.get(slug);if(!page)throw Error('Missing core page for experience edit '+slug);
  const sourceSection = /<section class="section (?:story-section|clinician-story|concern-layout|approach-layout|resource-layout)">[\s\S]*?<\/section>/;
  if(!sourceSection.test(html))throw Error('Expected editable body missing: '+slug);
  let heading,body,related,asideTitle;
  if(entry){heading=entry.heading;body=entry.sections.map(s=>`<section class="experience-prose"><h2>${esc(s.heading)}</h2>${s.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}</section>`).join('');related=cards(entry.topics,ctx,slug);asideTitle='Follow the question that brought you here';}
  if(approach){heading=page.name;const matches=evidence.clinicians.filter(p=>p.approaches.includes(slug));
    body=`<section class="experience-prose"><h2>What this approach emphasizes</h2><p>${esc(page.summary)}</p></section><section class="experience-prose"><h2>${esc(approach.heading)}</h2><p>${esc(approach.paragraph)}</p></section><section class="experience-prose"><h2>Ask about the person and the plan</h2><p>These clinicians name this approach in their published biographies. Read their profiles, then ask how they use it and whether it fits the care you are seeking. A profile description does not establish certification or current availability.</p><p>For a comparison of styles, read the therapy approaches library or the guide to choosing a therapist. For practical questions before an appointment, use the starting-care guide. Those are separate reading paths, not a recommendation to select a method before speaking with a clinician.</p></section>`;
    related=peopleCards(matches.map(p=>p.slug),ctx);asideTitle='Profiles that describe this approach';
    if(!related)related='<p>No clinician-specific use is asserted here. Ask the practice about current services rather than assuming every listed approach is offered by every clinician.</p>';
    related+=cards(['how-to-choose-a-therapist','what-happens-first-therapy-session'],ctx,slug,2);
  }
  if(person){heading='Get to know the person behind the profile';
    const clients=field(html,/<dt>Clients<\/dt>\s*<dd>([\s\S]*?)<\/dd>/);
    const fullFocus=field(html,/<dt>Focus areas<\/dt>\s*<dd>([\s\S]*?)<\/dd>/);
    const focusTargets=targetsFor(fullFocus,ctx,slug);
    body=`<section class="experience-prose"><h2>How this clinician describes their work</h2><p>${esc(page.summary)}</p><dl class="experience-facts"><dt>Who they work with</dt><dd>${esc(clients)}</dd></dl></section><section class="experience-prose"><h2>Follow a focus area into more detail</h2><p>Explore the focus areas described in this biography. Open a topic to read more, then ask about how this clinician works with the question you are bringing.</p><p class="experience-profile-focus">${esc(fullFocus)}</p></section><section class="experience-prose"><h2>Bring a question about working together</h2><p>You might ask how the first appointment is structured, how your priorities would shape the work, or how to raise a concern about fit. Check the appointment format, availability, and intended service before requesting a time. You can request an appointment with this clinician directly from this profile.</p><div class="experience-topic-grid">${cards(focusTargets,ctx,slug,6)}</div></section>`;
    related=cards(person.approaches,ctx,slug,10);asideTitle='Approaches named in the published profile';
    if(!related)related='<p>Ask this clinician how they work; no additional approach use is being inferred.</p>';
  }
  const block=`<section class="section experience-body" data-experience-body="${slug}" aria-label="${esc(heading)}"><div class="experience-reading">${body}</div><aside class="experience-sidebar"><p class="kicker">Explore related care</p><h2>${esc(asideTitle)}</h2><div class="experience-topic-grid">${related}</div></aside></section>`;
  return html.replace(sourceSection,block).replace(/<section class="section action-band">[\s\S]*?<\/section>/g,'');
}
function replaceLists(html,slug,ctx) {
  return html.replace(/<ul class="value-list">([\s\S]*?)<\/ul>/g,(whole,inside)=>{
    const labels=[...inside.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(m=>plain(m[1]));
    let targets=labels.flatMap(label=>targetsFor(label,ctx,slug));
    if(!targets.length && ctx.catalog.get(slug)?.tags){
      const tags=new Set(ctx.catalog.get(slug).tags);
      targets=[...ctx.catalog.values()].filter(e=>e.slug!==slug&&(e.tags||[]).some(t=>tags.has(t))).sort((a,b)=>Number(b.core)-Number(a.core)||a.slug.localeCompare(b.slug)).map(e=>e.slug);
    }
    const links=cards(targets,ctx,slug,6);if(!links)return whole;
    const unmapped=labels.filter(label=>!targetsFor(label,ctx,slug).length&&!/core ideas|questions to ask|how sessions|related concerns|how the concern|patterns that|impact on|goals worth|life stage|relevant concerns|clinician experience|in-person or online|each partner|recurring interaction|repair and communication|when additional|what the term|questions worth|what may vary|where to continue/i.test(label));
    return `<div class="experience-topic-grid" data-linked-focus>${links}</div>${unmapped.length?`<p class="experience-context">Also part of the conversation: ${esc(unmapped.join('; '))}.</p>`:''}`;
  });
}
// Link text nodes only, never markup/URLs, source citations, forms, or existing anchors.
function contextualLinks(html,slug,ctx){
  const stack=[], used=new Set([...html.matchAll(/<a class="experience-inline" href="\/([^"\/]+)\/"/g)].map(m=>m[1])),cap=10;
  return html.split(/(<!--[\s\S]*?-->|<[^>]+>)/g).map(token=>{
    if(token.startsWith('<')){
      if(/^<\//.test(token)){const tag=token.match(/^<\/([\w-]+)/)?.[1]?.toLowerCase();let i=stack.length-1;while(i>=0&&stack[i].tag!==tag)i--;if(i>=0)stack.splice(i);}
      else if(!/^<!/.test(token)){const tag=token.match(/^<([\w-]+)/)?.[1]?.toLowerCase();if(tag&&!/^(?:img|input|meta|link|br|hr|source|wbr|area|base|embed|param|track|col)$/.test(tag)&&!token.endsWith('/>'))stack.push({tag,attrs:token});}
      return token;
    }
    if(!token.trim()||used.size>=cap||!stack.some(n=>n.tag==='main')||!stack.some(n=>['p','dd','li'].includes(n.tag)))return token;
    if(stack.some(n=>['a','script','style','nav','header','footer','form','textarea','button','summary'].includes(n.tag)||/class="[^"]*(?:hero|ed-sources|ed-section-sources|ed-questions|experience-topic|start-helper)/.test(n.attrs)))return token;
    const pieces=[];let rest=token;
    while(rest&&used.size<cap){let best=null;
      for(const a of ctx.aliases){if(a.slug===slug||used.has(a.slug)||!ctx.canLink(a.slug))continue;
        const re=new RegExp('(?<![A-Za-z0-9])'+a.label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![A-Za-z0-9])','i');const m=re.exec(rest);
        if(m&&(!best||m.index<best.at||(m.index===best.at&&m[0].length>best.text.length)))best={at:m.index,text:m[0],slug:a.slug};}
      if(!best)break;
      pieces.push(rest.slice(0,best.at),`<a class="experience-inline" href="/${best.slug}/">${best.text}</a>`);used.add(best.slug);rest=rest.slice(best.at+best.text.length);
    }return pieces.join('')+rest;
  }).join('');
}
function applyExperience(html,route,ctx){
  const slug=route.replace(/^\/+|\/+$/g,'');
  let out=html.replace(/<nav\b[^>]*class="[^"]*\bbreadcrumbs\b[^"]*"[^>]*>[\s\S]*?<\/nav>/g,'');
  const reference=require('./reference-pages');
  const composeReference=reference.enabled()&&reference.has(slug);
  if(composeReference){
    if(!/<main\b[^>]*>[\s\S]*?<\/main>/.test(out))throw Error('Missing reference page shell');
    out=out.replace(/<main\b[^>]*>[\s\S]*?<\/main>/,reference.render(slug));
  }
  if(!/marriage-reset-assessment/.test(slug)&&!composeReference){
    out=detailBody(out,slug,ctx);
    out=replaceLists(out,slug,ctx);
    out=out.replace(/(>)(Verify insurance)(<\/a>)/gi,'$1Verify benefits$3');
    out=out.replace(/Use secure practice workflows/g,'Schedule your appointment').replace(/use the secure appointment pathway/g,'request an appointment in SimplePractice').replace(/use secure practice workflows/g,'request an appointment in SimplePractice');
    // Keep useful article endings; discard the old repeated, staff-oriented closing block.
    out=out.replace(/<section class="section final-cta reveal">(?:(?!<\/section>)[\s\S])*?Start through the secure client-care system\.(?:(?!<\/section>)[\s\S])*?<\/section>/g,'');
    out=contextualLinks(out,slug,ctx);
  }
  // Data hooks are added without changing the official brand artwork or footer content.
  if(!out.includes('data-mft-experience'))out=out.replace(/<body\b/,'<body data-mft-experience="plaud-sitewide"');
  if(!out.includes('/assets/site-experience.js'))out=out.replace('</body>','<script src="/assets/site-experience.js" defer></script></body>');
  if(/\bdata-spwidget-/.test(out))out=booking.decorateHtml(out,route).html;
  ctx.report.set(route,{route,detailedBody:out.includes('data-experience-body='),breadcrumbs:(out.match(/class="[^"]*\bbreadcrumbs\b/g)||[]).length,contextLinks:(out.match(/class="experience-inline"/g)||[]).length,topicCards:(out.match(/data-linked-topic=/g)||[]).length});
  return out;
}
module.exports={createContext,applyExperience,contextualLinks,targetsFor,cards,plain,esc};
