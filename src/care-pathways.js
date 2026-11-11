'use strict';
// Authored care navigation and page-specific compositions. No client-side quiz,
// clinical intake, new tracking, booking endpoint or age-based diagnosis.
const fs = require('node:fs');
const path = require('node:path');
const ui = require('./ui/home-components');
const e = ui.esc;
const CONJOINT = 'individual-therapy-with-support-person';
const ROOT = path.resolve(__dirname, '..');
const GUIDE = '/how-to-start-therapy/';
const individual = '/new-page/';
const couples = '/marriage-and-couples-therapy-counseling/';
const family = '/family-therapy-group-counseling/';
const join = '/' + CONJOINT + '/';
const pageDesigns = {
  'new-page': {
    key:'adult', kicker:'Adult individual therapy', title:'A place to understand what you need.',
    summary:'There is room for the parts of your life that do not fit neatly into a label. Begin with your experience, your questions, and what you would like to be different.',
    focus:'One person. Your needs, your goals, your treatment.',
    panel:'<p class="kicker">A question worth making room for</p><h2>What would you like to be different?</h2><ul class="care-prompts"><li>The way your days feel.</li><li>The choices in front of you.</li><li>The patterns you keep returning to.</li></ul>'
  },
  'childrentherapy': {
    key:'child', kicker:'Child therapy', title:'Understanding their world. Supporting their growth.',
    summary:'Start with the child behind the concern. Explore care that makes room for their stage of development, their way of communicating, and the people who support them.',
    focus:'Your child is at the center. Caregiver involvement is planned around their care.',
    panel:'<div class="care-growth" aria-hidden="true"><i></i><i></i><i></i></div><p class="kicker">Two parts of the same support</p><h2>A child\'s space.<br>A caregiver\'s place.</h2><p>We clarify how each person participates, rather than assuming every conversation needs everyone in the room.</p>'
  },
  'teen-counseling': {
    key:'teen', kicker:'Teen counseling', title:'Your voice belongs in the conversation.',
    summary:'School, friendships, identity, home, the future. You may have a lot on your mind without knowing how to explain it yet. Your perspective is a place to begin.',
    focus:'The teen is the individual client. Privacy and caregiver participation need a clear conversation.',
    panel:'<div class="care-teen-note"><p class="kicker">For teens</p><h2>You do not have to have the perfect words.</h2><p>Ask questions. Say what does not fit. Talk with your clinician about what stays private and when information may need to be shared.</p></div><div class="care-caregiver-note"><p class="kicker">For caregivers</p><p>Your observations matter. So does making room for a perspective that may be different from yours.</p></div>'
  },
  'marriage-and-couples-therapy-counseling': {
    key:'couples', kicker:'Couples & marriage therapy', title:'Two experiences. A relationship worth understanding.',
    summary:'When the same conversation keeps ending in the same place, the work is not simply choosing a side. It is understanding the relationship and what needs to change within it.',
    focus:'The relationship is the focus. This is not one partner\'s individual therapy.',
    panel:'<p class="kicker">Your path into couples care</p><h2>First understand.<br>Then work together.</h2><p>All couples start with a paid 30-minute consultation. A 10-minute phone introduction is optional.</p><ol class="care-sequence"><li><span>01</span><div><b>30-minute couples consultation</b><small>The required first step; private pay.</small></div></li><li><span>02</span><div><b>One evaluation for each partner</b><small>Separate visits to inform the joint plan.</small></div></li><li><span>03</span><div><b>53-minute couples sessions</b><small>After the consultation and both evaluations.</small></div></li></ol><a class="care-inline" href="/how-to-start-therapy/#couples-journey">Understand the full journey &rarr;</a>'
  },
  'family-therapy-group-counseling': {
    key:'family', kicker:'Family therapy', title:'More than one perspective. A way forward together.',
    summary:'Families change. Roles shift. Old expectations meet new needs. Make room to work on the relationships between you, rather than asking one person to carry the whole problem.',
    focus:'Shared family relationships are the focus. Participants are chosen around the work.',
    panel:'<div class="care-family-orbit" aria-hidden="true"><i></i><i></i><i></i><span>+</span></div><p class="kicker">Across generations and life stages</p><h2>Less blame.<br>A clearer picture.</h2><p>Parents and children. Adult siblings. Blended families. The starting question is which relationships need attention, not whether your family fits one picture.</p>'
  }
};
function arrow(href, label, cls='care-inline') { return `<a class="${cls}" href="${ui.href(href)}">${e(label)} <span aria-hidden="true">&rarr;</span></a>`; }
function hero(p) {
  const d=pageDesigns[p.slug]; if(!d) return ui.hero(p.hero);
  return `<section class="care-hero care-hero--${d.key} mft-component" data-ui="hero"><div class="care-hero-copy"><p class="kicker">${e(d.kicker)} <span aria-hidden="true">/</span> M.F.T.</p><h1>${e(d.title)}</h1><p class="care-summary">${e(d.summary)}</p><div class="actions">${p.hero.actions.map((a,i)=>ui.button(a,i?'ghost':'primary')).join('')}</div><p class="care-definition">${e(d.focus)}</p></div><aside class="care-panel care-panel--${d.key}" data-ui="panel">${d.panel}</aside></section>`;
}
function decorate(html, slug) {
  const d=pageDesigns[slug]; if(!d) return html;
  const p=require('./reference-pages').get(slug);
  const original=ui.hero(p.hero);
  if(!html.includes(original)) throw Error('Care hero source changed: '+slug);
  let out=html.replace(original,hero(p)).replace('<main ',`<main data-care-service="${d.key}" `);
  if(slug==='new-page') {
    const before=p.sections.find(s=>s.id==='choose-the-work');
    const after={...before,title:'Your care can include support without changing its focus.',items:[
      {title:'Individual care, centered on you',paragraphs:['Your concerns and treatment goals guide the work. A therapy approach is the method your clinician uses; it is different from who the treatment is for.']},
      {title:'A support person can sometimes join',paragraphs:['With a plan agreed on with your clinician, a partner, caregiver, or other support person may participate in your individual treatment. This is not the same as starting couples or family therapy. [Explore individual therapy with a support person]('+join+').']}
    ]};
    out=out.replace(ui.comparison(before),ui.comparison(after));
  }
  if(slug==='family-therapy-group-counseling') {
    const before=p.sections.find(s=>s.id==='service-choice');
    const after={...before,title:'Are we working on the family, or supporting one person?',items:[
      {title:'Family therapy',paragraphs:['The work addresses shared family relationships: roles, expectations, communication, and how people respond to one another. Your clinician helps determine who should participate.']},
      {title:'Individual care with family involvement',paragraphs:['A child, teen, or adult may instead be the individual client, with a family member joining to support that person\'s treatment. More people attending does not automatically make it family therapy. [Understand conjoint individual sessions]('+join+').']}
    ]};
    out=out.replace(ui.comparison(before),ui.comparison(after));
  }
  const links={
    childrentherapy:['When a caregiver joins',join,'Learn how family participation can support one child\'s treatment.'],
    'teen-counseling':['Individual support or family work?',family,'The focus of care matters more than the number of people attending.'],
    'marriage-and-couples-therapy-counseling':['Coming as a support person?',join,'Joining a partner\'s individual treatment is a different arrangement from couples therapy.']
  };
  if(links[slug]) {
    const [title,href,text]=links[slug];
    out=out.replace('<section class="section mft-sources',`<aside class="care-context mft-component"><div><p class="kicker">A useful distinction</p><h2>${e(title)}</h2><p>${e(text)}</p></div>${arrow(href,'Compare the care')}</aside><section class="section mft-sources`);
  }
  return out;
}
function renderDirectory() {
 const audiences=[
  ['children','Child therapy','Understanding their world','Care centered on a child\'s development, with a thoughtful place for caregivers.','/childrentherapy/'],
  ['teens','Teen counseling','Room for their own voice','Support that respects a teen\'s perspective and makes privacy and participation clear.','/teen-counseling/'],
  ['adults','Adult therapy','Space for your next chapter','Individual care for your daily life, decisions, identity, and relationships.',individual]
 ];
 const formats=[
  ['01','Individual therapy','One person\'s care','Your needs and treatment goals guide the work. Children, teens, and adults can each receive individual care.',individual,'Explore individual care'],
  ['02','Individual therapy with a support person','One client, supported by someone else','A partner, caregiver, or other support person participates in the individual client\'s treatment. Also called conjoint sessions.',join,'Understand conjoint sessions'],
  ['03','Couples therapy','The couple\'s relationship','Work on how you relate to one another. Couples follow a separate starting process; consultations and sessions are private pay.',couples,'Explore couples care'],
  ['04','Family therapy','Shared family relationships','Work on patterns, roles, expectations, and communication among participating family members.',family,'Explore family care']
 ];
 return `<main id="main" data-reference-page="services" data-page-family="service-directory" data-design-system="homepage-shared-v1" data-care-directory="1">
 <section class="care-directory-hero mft-component" data-ui="hero"><div><p class="kicker">Marriage.Family.Therapy / Care that fits</p><h1>Different people.<br>Different kinds of care.</h1><p class="care-summary">You do not need to know the clinical language. Start with who needs support, then explore what the work will focus on.</p><div class="actions">${ui.button({href:'#care-options',label:'Find your starting point'})}${ui.button({href:'#therapy-formats',label:'Compare types of therapy'},'ghost')}</div></div><aside class="care-directory-note" data-ui="panel"><span class="care-brand-plus" aria-hidden="true">+</span><p class="kicker">Two questions. A clearer direction.</p><h2>Who needs support?<br>What needs attention?</h2><p>Age helps us understand the person.<br>The focus helps us choose the care.</p><p class="care-note-fine">A teen may need individual care.<br>An adult may need family care.<br>Two people attending does not always mean couples therapy.</p></aside></section>
 <nav class="care-page-nav mft-component" aria-label="Explore services"><a href="#care-options">Children, teens &amp; adults</a><a href="#therapy-formats">Compare therapy formats</a><a href="#your-next-step">Where to begin</a></nav>
 <section class="section care-audiences mft-component" id="care-options" data-ui="cards" aria-labelledby="care-audiences-title"><div class="care-section-top"><p class="kicker">01 / The person</p><div><h2 id="care-audiences-title">A different stage of life.<br>A different place to start.</h2><p>These are age groups, not competing therapy formats. Explore the guide that speaks to your experience.</p></div></div><div class="care-audience-grid">${audiences.map(([key,title,heading,text,href],i)=>`<article class="care-audience care-audience--${key}" id="${key}"><span class="care-audience-number" aria-hidden="true">0${i+1}</span><p class="kicker">${title}</p><h3>${heading}</h3><p>${e(text)}</p>${arrow(href,'Explore '+title.toLowerCase())}</article>`).join('')}</div></section>
 <section class="section care-formats mft-component" id="therapy-formats" aria-labelledby="care-formats-title"><div class="care-section-top"><p class="kicker">02 / The focus</p><div><h2 id="care-formats-title">What are we working on,<br>and who is the care for?</h2><p>The number of people in the room does not answer that question on its own.</p></div></div><div class="care-format-list">${formats.map(([num,title,focus,text,href,label])=>`<article class="care-format-row"><span class="care-format-number" aria-hidden="true">${num}</span><div><p class="kicker">${e(focus)}</p><h3>${e(title)}</h3></div><div><p>${e(text)}</p>${arrow(href,label)}</div></article>`).join('')}</div></section>
 <section class="section care-next mft-component" id="your-next-step" aria-labelledby="care-next-title"><p class="kicker">A manageable next step</p><h2 id="care-next-title">You can ask before you decide.</h2><p>You may start with an optional free 10-minute phone consultation. Individuals can also begin directly with a diagnostic evaluation. Couples begin with the required paid 30-minute consultation, then one evaluation per partner, before joint sessions.</p><div class="actions">${ui.button({href:GUIDE,label:'See how to start'})}${ui.button({href:'/team/',label:'Meet the team'},'ghost')}</div><p class="care-small">Confirm age range, service, availability, and in-person or online fit with your clinician. Coverage depends on the clinician, service, and plan. ${arrow('/check-my-coverage/','Understand payment and benefits')}</p></section>
 <section class="section care-further mft-component" aria-labelledby="care-further-title"><h2 id="care-further-title">More ways to explore relationship care.</h2><div>${arrow('/new-page-1/','Premarital counseling')}${arrow('/marriagereset/','Marriage.Reset')}${arrow('/new-page-2/','Proposed couples retreats')}</div><p class="care-small">Retreat information is a provisional concept, not a confirmed offering or reservation.</p></section></main>`;
}
function renderConjoint() {
 return `<main id="main" data-care-service="conjoint" data-care-guide="${CONJOINT}" data-page-family="service" data-design-system="homepage-shared-v1">
 <section class="care-hero care-hero--conjoint mft-component" data-ui="hero"><div class="care-hero-copy"><p class="kicker">Individual therapy with a support person / M.F.T.</p><h1>Your care.<br>With someone who can help.</h1><p class="care-summary">Sometimes it makes sense to invite a partner, parent, caregiver, or another support person into your individual treatment. Their participation has a purpose: supporting your care, not changing who the client is.</p><div class="actions">${ui.button({href:'#how-it-works',label:'Understand the arrangement'})}${ui.button({href:'#planning-a-session',label:'Plan with your clinician'},'ghost')}</div><p class="care-definition">Also called conjoint individual sessions. One identified client remains at the center of the treatment.</p></div><aside class="care-panel care-panel--conjoint" data-ui="panel"><p class="kicker">The focus stays clear</p><div class="care-focus-art" aria-hidden="true"><span>Your<br>goals</span><i></i><b>Support</b></div><h2>Another person.<br>The same treatment focus.</h2><p>Who attends matters. Why they attend matters more.</p></aside></section>
 <nav class="care-page-nav mft-component" aria-label="In this guide"><a href="#how-it-works">The purpose</a><a href="#what-it-is-not">What it is not</a><a href="#planning-a-session">Planning a session</a><a href="#conjoint-questions">Questions</a></nav>
 <section class="section care-conjoint-purpose mft-component" id="how-it-works" aria-labelledby="conjoint-purpose-title"><div><p class="kicker">A role, not just an invitation</p><h2 id="conjoint-purpose-title">Bring someone into the work.<br>Keep your care at the center.</h2><p>Your clinician first considers whether involving another person is appropriate for your treatment goals. Together, you clarify what their participation is intended to help with and what boundaries apply.</p><p>The support person is not automatically becoming an individual client of that therapist. Nor does attending turn the appointment into couples therapy. A change in the purpose of care needs a separate discussion.</p></div><aside class="care-purpose-notes"><h3>What participation might support</h3><p>A shared understanding of the client's treatment goals.</p><p>Practicing a specific communication or support skill together.</p><p>Helping a caregiver understand how to support a child between sessions.</p><small>Illustrative possibilities, not a recommendation for your situation or a promise that a joint session is appropriate.</small></aside></section>
 <section class="section care-distinction mft-component" id="what-it-is-not" aria-labelledby="conjoint-distinction-title"><p class="kicker">Similar attendance. Different work.</p><h2 id="conjoint-distinction-title">Two people can be in the room<br>for very different reasons.</h2><div class="care-distinction-grid"><article><p class="kicker">Conjoint individual care</p><h3>Supporting one person's treatment.</h3><p>The individual client's needs and treatment plan remain central. Another person participates in an agreed supporting role.</p>${arrow(individual,'Return to individual therapy')}</article><article><p class="kicker">Couples or family therapy</p><h3>Working on shared relationships.</h3><p>The work focuses on the couple's relationship or participating family relationships. It is not simply an extra person attending an individual session.</p>${arrow(couples,'Explore couples therapy')}${arrow(family,'Explore family therapy')}</article></div><p class="care-small">At M.F.T., couples care follows its own consultation and evaluation sequence. A support-person session does not replace those steps.</p></section>
 <section class="section care-planning mft-component" id="planning-a-session" aria-labelledby="care-planning-title"><div><p class="kicker">Before anyone joins</p><h2 id="care-planning-title">Make the plan together,<br>before the appointment.</h2><p>Speak with your individual clinician before inviting someone or choosing a different appointment type. They can help clarify whether a shared session fits and how to arrange it.</p></div><ol class="care-planning-list"><li><h3>Agree on the purpose.</h3><p>What specific part of the individual treatment would their participation support?</p></li><li><h3>Clarify privacy and participation.</h3><p>Discuss consent, what information may be shared, how records are handled, and each person's role. For children and teens, clarify caregiver involvement and applicable privacy limits with the clinician.</p></li><li><h3>Check that participation is appropriate.</h3><p>Let your clinician know privately about pressure, fear, or concerns about speaking openly. A joint appointment is not automatically the right arrangement.</p></li><li><h3>Confirm the service and payment.</h3><p>Ask which appointment to request and how it will be billed. We do not relabel couples work as individual treatment for insurance. Confirm benefits before relying on coverage.</p></li></ol></section>
 ${ui.faq({id:'conjoint-questions',kicker:'Before you arrange a visit',title:'A few practical distinctions.',items:[
  {question:'Can I bring someone without arranging it first?',answer:'Please discuss it with your clinician first. Agree on the purpose, participation, consent, and appointment arrangement rather than assuming that an individual appointment can be changed at arrival.'},
  {question:'Can a parent join a child or teen\'s care?',answer:'Caregiver participation may be part of a young person\'s individual treatment. The clinician should explain how it supports that person\'s needs, which conversations include caregivers, and the applicable privacy and consent arrangements.'},
  {question:'Does a partner joining make it couples therapy?',answer:'Not automatically. Supporting one person\'s treatment is different from working on the relationship as the focus of care. When relationship work is needed, discuss the couples pathway rather than changing the label of the individual appointment.'},
  {question:'Will insurance cover a session with a support person?',answer:'Participation alone does not establish coverage. Ask our support team to check the proposed service, clinician, and your specific plan. Couples consultations and couples therapy at M.F.T. are private pay.'}
 ]})}
 <section class="section care-next mft-component"><p class="kicker">Start with the person who knows your care</p><h2>Already in therapy?<br>Ask your clinician first.</h2><p>New to M.F.T.? Compare the types of care or read the starting guide before choosing an appointment.</p><div class="actions">${ui.button({href:'/services/#therapy-formats',label:'Compare care options'})}${ui.button({href:GUIDE,label:'See how to start'},'ghost')}</div></section></main>`;
}
function metadata(html) {
 const title='Individual Therapy with a Support Person | M.F.T.';
 const description='Understand conjoint individual sessions: involving a partner, parent, or caregiver while keeping one client\'s treatment goals at the center of care.';
 const url='https://www.mft.care/'+CONJOINT+'/';
 let out=html.replace(/<title>[\s\S]*?<\/title>/,`<title>${e(title)}</title>`)
 .replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${e(description)}">`)
 .replace(/<link rel="canonical" href="[^"]*">/,`<link rel="canonical" href="${url}">`)
 .replace(/<meta property="og:(title|description|url)" content="[^"]*">/g,(_,key)=>`<meta property="og:${key}" content="${e({title,description,url}[key])}">`)
 .replace(/<meta name="robots" content="[^"]*">/,'<meta name="robots" content="noindex,nofollow">');
 out=out.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/,(_,raw)=>{
  const schema=JSON.parse(raw);schema['@graph']=(schema['@graph']||[]).filter(x=>['Organization','WebSite'].includes(x['@type']));
  schema['@graph'].push({'@type':'WebPage','@id':url+'#webpage',url,name:title,description,isPartOf:{'@id':'https://www.mft.care/#website'},about:{'@id':'https://www.mft.care/#organization'}});
  return '<script type="application/ld+json">'+JSON.stringify(schema).replace(/</g,'\\u003c')+'</script>';
 });
 return out;
}
function prepare(root=ROOT) {
 const dist=path.join(root,'dist');
 const source=fs.readFileSync(path.join(dist,'new-page/index.html'),'utf8');
 if(!/<main\b[^>]*>[\s\S]*?<\/main>/.test(source))throw Error('Missing shared individual page shell');
 const html=metadata(source.replace(/<main\b[^>]*>[\s\S]*?<\/main>/,renderConjoint()));
 const destination=path.join(dist,CONJOINT,'index.html');fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,html);
 fs.appendFileSync(path.join(dist,'assets/styles.css'),fs.readFileSync(path.join(root,'src/assets/care-pathways.css'),'utf8'));
 // The new route is review-only: not added to the sitemap or analytics allowlist.
 console.log(JSON.stringify({carePathways:'authored',newReviewRoute:CONJOINT,existingServiceRoutes:Object.keys(pageDesigns).length,productionRelease:false}));
}
if(require.main===module)prepare();
module.exports={CONJOINT,pageDesigns,hero,decorate,renderDirectory,renderConjoint,metadata,prepare};
