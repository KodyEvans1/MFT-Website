'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {applyPlaudEdits,startMain,SCHEDULE,BENEFITS,QUESTION,MR_ACCESS} = require('../src/start-page');
const {decorateHtml,config} = require('../src/booking-build');
const fixture = '<html><head><title>How to Start Therapy</title></head><body><header>original brand and navigation</header><main id="main"><nav class="breadcrumbs">old trail</nav><section>Use secure practice workflows</section><section class="section final-cta reveal">repeated close</section></main><footer>original footer</footer></body></html>';
const read = slug => fs.readFileSync(path.join(__dirname,'../dist',slug,'index.html'),'utf8');
const main = html => html.match(/<main\b[^>]*>[\s\S]*?<\/main>/)[0];
const anchors = html => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];

test('Plaud: named first page replaces only the main region',()=>{
 const html=applyPlaudEdits(fixture,'/how-to-start-therapy/');
 assert.match(html,/<header>original brand and navigation<\/header>/);
 assert.match(html,/<footer>original footer<\/footer>/);
 assert.doesNotMatch(main(html),/breadcrumbs|secure practice workflows|final-cta|repeated close/);
 assert.equal((html.match(/<h1[ >]/g)||[]).length,1);
 assert.equal(applyPlaudEdits(html,'/how-to-start-therapy/'),html);
});
test('Plaud: missing target main fails rather than silently dropping content',()=>{
 assert.throws(()=>applyPlaudEdits('<html></html>','/how-to-start-therapy/'),/missing/);
});
test('Plaud: no other resource or editorial article is redesigned',()=>{
 for(const route of ['/how-to-choose-a-therapist/','/person-centered-therapy/','/team/','/online-therapy-bothell-wa/']) assert.equal(applyPlaudEdits(fixture,route),fixture);
});
test('Plaud: three steps use the requested language and actual links',()=>{
 const html=startMain();
 assert.match(html,/Clarify what you are looking for/);assert.match(html,/Review clinician information/);assert.match(html,/<h3>Schedule<\/h3>/);
 assert.equal((html.match(/class="start-number"/g)||[]).length,3);
 assert.match(html,/href="\/services\/"/);assert.match(html,/href="\/team\/"/);
});
test('Plaud: benefits and questions are email links, never public intake forms',()=>{
 const html=startMain(); assert.ok(html.includes('href="'+BENEFITS+'"'));assert.ok(html.includes('href="'+QUESTION+'"'));
 assert.doesNotMatch(html,/<form\b|<input\b|<textarea\b|mailto:support@mftcare/i);
 assert.match(html,/Opens your email app/);
});
test('Plaud: starting-care scheduling is bound once to the supplied general widget',()=>{
 const html=decorateHtml(applyPlaudEdits(fixture,'/how-to-start-therapy/'),'/how-to-start-therapy/').html;
 const links=anchors(main(html)).filter(a=>a[1].includes('data-mft-booking'));
 assert.equal(links.length,3);
 for(const a of links){assert.ok(a[1].includes('href="'+config.generalUrl+'"'));assert.match(a[1],/data-spwidget-scope-global/);assert.doesNotMatch(a[1],/data-spwidget-clinician-id/);}
 assert.equal(html.split('src="'+config.loaderUrl+'"').length-1,1);
 assert.equal(decorateHtml(html,'/how-to-start-therapy/').html,html);
 const portal=anchors(main(html)).find(a=>a[2]==='existing client portal');assert.ok(portal);assert.doesNotMatch(portal[1],/data-mft-booking/);
});
test('Plaud: FAQ uses native details and all fragment destinations exist',()=>{
 const html=startMain();assert.equal((html.match(/<details>/g)||[]).length,4);
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
 for(const m of html.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(m[1]),m[1]);
});
test('Plaud: homepage keeps existing content and footer, without generic closing CTA',()=>{
 const html=applyPlaudEdits(fixture,'/');assert.match(html,/old trail/);assert.match(html,/<footer>original footer<\/footer>/);assert.doesNotMatch(html,/repeated close/);
});
test('Plaud: Marriage.Reset gets a separate client sign-in without changing booking',()=>{
 const a='<a class="button dark" href="/marriage-reset-assessment/">Start the free Marriage.Reset assessment</a>';
 const html=applyPlaudEdits(fixture.replace('<section>Use secure practice workflows</section>',a),'/marriagereset/');
 assert.match(html,/data-mr-client-access/);assert.ok(html.includes('href="'+MR_ACCESS+'"'));assert.ok(html.includes(a));
 assert.equal(applyPlaudEdits(html,'/marriagereset/'),html);
 assert.throws(()=>applyPlaudEdits(fixture,'/marriagereset/'),/placement/);
});
test('Plaud: built target retains brand, metadata, footer and correct links',()=>{
 const html=read('how-to-start-therapy');const m=main(html);
 assert.match(m,/class="start-guide"/);assert.doesNotMatch(m,/breadcrumbs|final-cta|practice workflows/);
 assert.match(html,/<img[^>]*src="\/assets\/mft-logo.svg"/);
 assert.doesNotMatch(html,/Marriage\.Family\.Therapy\.(?![a-z])/);
 assert.match(html,/href="\/marriagereset\/"/);assert.match(html,/rel="canonical"/);
 for(const a of anchors(html).filter(a=>a[2].trim()==='Staff operations'))assert.ok(html.indexOf(a[0])>html.indexOf('<footer'));
 assert.doesNotMatch(m,/href="https:\/\/ops\.mft\.care/);
});
test('Plaud: generic decision drafts do not inherit the first-page redesign',()=>{
 const registry=require('../content/seo-registry.json');
 for(const entry of registry.decisionGuides)assert.doesNotMatch(main(read(entry.slug)),/class="start-guide"/);
});
test('Plaud: output footer is identical on homepage, start guide and Marriage.Reset',()=>{
 const foot = h => h.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/)[0];
 assert.equal(foot(read('')),foot(read('how-to-start-therapy')));assert.equal(foot(read('')),foot(read('marriagereset')));
 assert.doesNotMatch(main(read('')),/Start through the secure client-care system/);
 const a=anchors(main(read('marriagereset'))).find(a=>a[1].includes('data-mr-client-access'));
 assert.ok(a);assert.doesNotMatch(a[1],/data-mft-booking|data-spwidget/);
});
