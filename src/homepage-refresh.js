'use strict';
// Homepage-only presentation pass. Run BEFORE booking/analytics and SEO fingerprints.
// Existing URLs, approvals, clinical content, shared components and footer stay intact.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ui = require('./ui/home-components');
const presentation = require('./ui/clinician-presentation');
const people = require('../content/clinician-registry.json').clinicians;
const home = require('../content/homepage.json');
const scheduling = require('./scheduling-actions');
const ROOT = path.resolve(__dirname, '..');
const LOBBY = 'https://images.squarespace-cdn.com/content/v1/65b78566ba645b4f0f011c30/1cbcf430-dfe2-4b69-9d9f-7ac53733849e/Individual%2BTherapy%2BLobby.png';
const version = text => crypto.createHash('sha256').update(text).digest('hex').slice(0,12);
function take(html, expression, name) {
  const match = html.match(expression);
  if (!match) throw Error('Homepage refresh: missing ' + name);
  return match[0];
}
function profileCards(dist) {
  return people.filter(p => p.status === 'current').map(p => {
    const html = fs.readFileSync(path.join(dist,p.slug,'index.html'),'utf8');
    const source = html.match(/<img class="hero-media" src="([^"]+)"/)?.[1];
    if (!source) throw Error('Homepage refresh: missing published portrait for '+p.slug);
    const url = new URL(ui.href(source.replace(/&amp;/g,'&')));
    url.searchParams.set('format','500w');
    const population = p.populations.filter(x => ['children','teens','adults','couples','families','older-adults'].includes(x)).map(x => x === 'older-adults' ? 'Older adults' : x[0].toUpperCase()+x.slice(1)).join(' \u00b7 ');
    const portrait = presentation.portrait(url.href,p.name,'directory').replace('mft-portrait--directory"','mft-portrait--directory mh-portrait"').replace(' loading="lazy"',' width="400" height="500" decoding="async" loading="lazy"');
    return `<article class="mh-person" data-home-clinician="${ui.esc(p.slug)}"><a href="/${ui.esc(p.slug)}/" class="mh-person-link">${portrait}<div class="mh-person-copy"><h3>${ui.esc(p.name)}</h3><p class="mh-license">${ui.esc(p.license)}</p><p class="mh-populations">${ui.esc(population)}</p><span class="mh-text-link">View profile <span aria-hidden="true">&rarr;</span></span></div></a></article>`;
  }).join('');
}
function paths() {
  const titles = ['Individual therapy','Couples & marriage','Child therapy','Teen counseling'];
  const actions = ['Explore individual therapy','Explore couples therapy','Explore child therapy','Explore teen counseling'];
  if (home.questions.items.length !== 4) throw Error('Homepage pathway count changed; review composition.');
  return `<section class="section home-questions mft-component mh-pathways" data-ui="cards" id="find-support" aria-labelledby="find-support-title">${ui.heading({...home.questions,id:'find-support'})}<div class="mh-path-grid">${home.questions.items.map((p,i)=>`<a class="mh-path mh-path-${i}" data-ui="card" href="${ui.esc(ui.href(p.href))}"><span class="mh-path-art" aria-hidden="true"><i></i><i></i><i></i></span><div class="mh-path-copy"><p class="mh-eyebrow">${ui.esc(p.title)}</p><h3>${ui.esc(titles[i])}</h3><p>${ui.rich(p.text)}</p><span class="mh-text-link">${actions[i]} <span aria-hidden="true">&rarr;</span></span></div></a>`).join('')}</div></section>`;
}
function apply(html,dist=path.join(ROOT,'dist')) {
  if (html.includes('data-home-refresh="20261013"')) return html;
  if (!/<body[^>]*class="page-home"/.test(html)) throw Error('Homepage refresh may only target the homepage.');
  // The later launch-content pass is idempotent; keep its existing approved feedback.
  html = require('./launch-content').apply(html,'');
  const main = take(html,/<main\b[^>]*>[\s\S]*?<\/main>/,'main');
  let hero = take(main,/<section class="home-hero mft-component"[\s\S]*?<\/section>/,'shared hero');
  const panel = take(hero,/<aside class="home-hero-panel"[\s\S]*?<\/aside>/,'practical panel');
  const steps = take(main,/<section class="section home-steps[\s\S]*?<\/section>/,'steps');
  const faq = take(main,/<section class="section home-faq[\s\S]*?<\/section>/,'FAQ');
  const feedback = take(main,/<section class="section mft-testimonials"[\s\S]*?<\/section>/,'existing feedback');
  const photo = `<figure class="mh-hero-visual"><div class="mh-photo-frame"><img class="hero-media mh-lobby" src="${LOBBY}?format=1000w" srcset="${LOBBY}?format=500w 500w, ${LOBBY}?format=1000w 1000w, ${LOBBY}?format=1500w 1500w" sizes="(max-width:760px) 92vw, 46vw" alt="Comfortable seating in the M.F.T. lobby" width="1000" height="1250" fetchpriority="high" decoding="async" referrerpolicy="no-referrer"></div><figcaption><span class="mh-photo-mark" aria-hidden="true">+</span><span>A place to arrive.<br><strong>Space to be yourself.</strong></span></figcaption><span class="mh-photo-location">Woodinville, Washington</span></figure>`;
  hero = hero.replace(panel,photo).replace('class="home-hero mft-component"','class="home-hero mft-component mh-hero"');
  hero = hero.replace(ui.esc(home.hero.title),'<span class="mh-h1-lead">Find the right therapist.</span> <span class="mh-h1-follow">Start in the way that feels manageable.</span>');
  hero = hero.replace('</div></div><figure','</div><p class="mh-hero-note">Not sure which appointment to choose? <a href="/how-to-start-therapy/">How scheduling works &rarr;</a></p></div><figure');
  hero = hero.replace(/<div class="actions">[\s\S]*?<\/div>/, scheduling.homeActions());
  const strip = `<nav class="mh-trust" aria-label="Care at M.F.T."><a href="/therapy-contact-woodinville/">In person in Woodinville</a><span aria-hidden="true">+</span><a href="/online-therapy-washington/">Online across Washington</a><span class="mh-trust-divider" aria-hidden="true"></span><a href="/new-page/">Individuals</a><a href="/marriage-and-couples-therapy-counseling/">Couples</a><a href="/childrentherapy/">Children</a><a href="/teen-counseling/">Teens</a><a href="/family-therapy-group-counseling/">Families</a></nav>`;
  const connection = `<section class="section mh-connection" aria-labelledby="home-connection-title"><div class="mh-connection-copy"><p class="kicker">You can start here</p><h2 id="home-connection-title">You don&rsquo;t have to know<br>exactly what you need.</h2><p>You may only know that something isn&rsquo;t working the way you want it to &mdash; in your relationship, at home, at work, or inside yourself. We can start there.</p><a class="mh-text-link" href="/what-we-help-with/">Explore what brings you here <span aria-hidden="true">&rarr;</span></a></div><ul class="mh-thoughts" aria-label="Common reasons to consider therapy"><li>We keep having the same fight.</li><li>I don&rsquo;t feel like myself lately.</li><li>I&rsquo;m worried about my child.</li><li>Something needs to change.</li></ul></section>`;
  const team = `<section class="section mh-team" aria-labelledby="home-team-title"><div class="mh-section-top"><div><p class="kicker">The people behind the care</p><h2 id="home-team-title">Find someone who feels like a fit.</h2><p>Get to know our clinicians, who they work with, and how they approach therapy.</p></div><a class="mh-text-link" href="/team/">Meet the whole team <span aria-hidden="true">&rarr;</span></a></div><div class="mh-team-grid">${profileCards(dist)}</div><p class="mh-small">Explore each profile for focus areas and approaches. Confirm appointment format and current availability when scheduling.</p></section>`;
  const practical = `<section class="section mh-practical" aria-labelledby="home-practical-title"><div class="mh-practical-copy"><p class="kicker">Room for your next chapter</p><h2 id="home-practical-title">A familiar place.<br>A flexible way to meet.</h2><p>Join us in Woodinville, or explore secure online care while you are physically located in Washington. Choose the format that fits your needs with your clinician.</p><div class="mh-mode-links"><a href="/therapy-contact-woodinville/">Visit the Woodinville office <span aria-hidden="true">&rarr;</span></a><a href="/online-therapy-washington/">Explore online therapy <span aria-hidden="true">&rarr;</span></a><a href="/check-my-coverage/">Understand insurance &amp; payment <span aria-hidden="true">&rarr;</span></a></div></div>${panel}</section>`;
  const closing = `<section class="section mft-component mh-closing" aria-labelledby="home-next-step-title"><p class="kicker">One manageable next step</p><h2 id="home-next-step-title">Let&rsquo;s begin with a conversation.</h2><p>You don&rsquo;t have to decide everything today.</p><div class="actions">${ui.button(home.hero.actions[0])}${scheduling.couplesButton()}${scheduling.existingButton()}</div><p class="mh-small">The free meet-and-greet is a brief phone introduction, not a therapy session. Couples consultations and therapy are private pay.</p></section>`;
  const nextMain = main.match(/^<main\b[^>]*>/)[0]+hero+strip+paths()+connection+team+practical+steps+faq+feedback+closing+'</main>';
  let result = html.replace(main,nextMain).replace('<body ','<body data-home-refresh="20261013" ');
  for (const name of ['homepage-refresh.css','homepage-refresh.js']) {
    const source = fs.readFileSync(path.join(ROOT,'src/assets',name),'utf8');
    const tag = name.endsWith('.css') ? `<link rel="stylesheet" href="/assets/${name}?v=${version(source)}">` : `<script src="/assets/${name}?v=${version(source)}" defer></script>`;
    result = result.replace(name.endsWith('.css')?'</head>':'</body>',tag+(name.endsWith('.css')?'</head>':'</body>'));
  }
  return result;
}
function build(dist=path.join(ROOT,'dist')) {
  const file=path.join(dist,'index.html');
  fs.writeFileSync(file,apply(fs.readFileSync(file,'utf8'),dist));
  for (const name of ['homepage-refresh.css','homepage-refresh.js']) fs.copyFileSync(path.join(ROOT,'src/assets',name),path.join(dist,'assets',name));
  console.log('Homepage visual refresh: composed one homepage; shared pages unchanged.');
}
if (require.main === module) build();
module.exports={apply,build,LOBBY};
