'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const acquisition = require('../src/acquisition-ux');
const booking = require('../content/simplepractice-booking.json');
const autumn = require('../content/autumn-profile.json');
const {inlineEvaluationPrice} = require('../src/appointment-costs');
const root = path.resolve(__dirname, '..');
const read = slug => fs.readFileSync(path.join(root, 'dist', slug, 'index.html'), 'utf8');
// Compose against the actual generated page shells. This also runs before the
// release owner wires the final stage into the full build; it performs no writes.
const output = slug => acquisition.apply(read(slug), slug);
const plain = html => html.replace(/<[^>]*>/g, ' ').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const textContent = html => html.replace(/<[^>]*>/g, '').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const hero = html => html.match(/<main\b[^>]*>[\s\S]*?(<section\b[\s\S]*?<\/section>)/)?.[1];
const anchors = (html, marker) => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].filter(m => m[1].includes(marker));
const href = anchor => anchor[1].match(/\bhref="([^"]+)"/)[1].replace(/&amp;/g, '&');

test('acquisition UX is limited to five content routes and two shared-style routes and is idempotent', () => {
  assert.deepEqual(acquisition.contentRoutes, ['emily-johnsrud-bio','autumn-alexander','new-page','marriage-and-couples-therapy-counseling','online-therapy-washington']);
  assert.deepEqual(acquisition.routes, [...acquisition.contentRoutes, 'how-to-start-therapy', 'check-my-coverage']);
  const unrelated = '<html><head><title>Unrelated page</title></head><body><main>Existing content</main></body></html>';
  for (const slug of ['', 'team', 'gary-ashley', 'sonia-hassan-bio', 'childrentherapy', 'online-therapy-tri-cities-wa']) {
    assert.equal(acquisition.apply(unrelated, slug), unrelated, slug);
  }
  for (const slug of acquisition.routes) {
    const html = output(slug);
    assert.equal(acquisition.apply(html, '/' + slug + '/'), html, slug);
    assert.equal((html.match(/data-acquisition-ux=/g) || []).length, 1, slug);
    assert.equal((html.match(/acquisition-ux\.css\?v=/g) || []).length, 1, slug);
    assert.ok(html.includes(`data-acquisition-route="${slug}"`), slug + ': missing acquisition route marker');
  }
});

test('Emily and Autumn primary, repeated and navigation actions retain their verified clinician destinations', () => {
  for (const [slug, key, id, channel, name] of [
    ['emily-johnsrud-bio','emily','2027366','professional_website','Emily'],
    ['autumn-alexander','autumn','2183370','client_portal','Autumn']
  ]) {
    const html = output(slug);
    const actions = anchors(html, 'data-acquisition-appointment=');
    assert.equal(actions.length, 5, slug);
    assert.deepEqual(new Set(actions.map(a => a[1].match(/data-acquisition-appointment="([^"]+)"/)[1])), new Set(['primary','header','repeated','footer','footer-utility']));
    for (const a of actions) {
      const url = new URL(href(a));
      assert.equal(plain(a[2]), `Request an Individual Evaluation With ${name}`);
      assert.equal(url.origin, 'https://clientsecure.me');
      assert.equal(url.pathname, '/widget-redirect');
      assert.equal(url.searchParams.get('clinicianId'), id);
      assert.equal(url.searchParams.get('channel'), channel);
      assert.equal(url.searchParams.get('scopeId'), booking.scopeId);
      assert.equal(url.searchParams.get('applicationId'), booking.applicationId);
      assert.equal(url.searchParams.get('appearance'), '{"fullScreen":true}');
      assert.match(a[1], new RegExp(`data-mft-clinician="${key}"`));
      assert.match(a[1], /data-mft-booking="true"/);
      assert.match(a[1], /data-mft-booking-intent="appointment"/);
      assert.match(a[1], new RegExp(`data-spwidget-clinician-id="${id}"`));
      assert.match(a[1], /data-mft-booking-mode="direct"/);
      assert.doesNotMatch(a[1], /onclick=|javascript:|target=/);
      for (const field of ['serviceId','locationId','appointmentType','startTime','gclid','gbraid','wbraid','utm_campaign_id']) {
        assert.equal(url.searchParams.has(field), false, field);
      }
    }
    const h = hero(html);
    assert.match(anchors(h, 'data-acquisition-appointment=')[0][1], /data-acquisition-appointment="primary"/);
    assert.ok(h.indexOf('data-acquisition-payment') < h.indexOf('data-acquisition-appointment="primary"'));
    assert.ok(plain(h).includes(inlineEvaluationPrice()));
    assert.match(h, /href="\/check-my-coverage\/"/);
    assert.match(plain(h), /clinician, service, plan, and benefits/);
    assert.match(plain(h), /request an individual evaluation directly/);
    assert.match(h, new RegExp(`href="#${key}-starting-costs"`));
    assert.match(html, /service, format, and time are not preselected/);
    assert.match(html, /Do not choose another service just to reserve a time/);
  }
});

test('clinician age and appointment formats use verified profile and current public catalogue facts', () => {
  const emily = hero(output('emily-johnsrud-bio'));
  assert.match(plain(emily), /Individual telehealth in Washington/);
  assert.match(plain(emily), /children ages 6\+, teens, and adults/);
  const autumnHero = hero(output('autumn-alexander'));
  assert.match(plain(autumnHero), /children ages 6\+, teens, young adults, and adults/);
  assert.match(plain(autumnHero), /Confirm the appointment format with Autumn before booking/);
  assert.doesNotMatch(plain(autumnHero), /couples|family therapy/i);
  for (const h of [emily, autumnHero]) {
    assert.match(plain(h), /telehealth/i);
    assert.match(plain(h), /physically in Washington/);
    assert.match(plain(h), /in-person care/i);
    assert.match(plain(h), /Woodinville/);
    assert.match(plain(h), /Confirm the appointment format/);
    assert.doesNotMatch(plain(h), /next available|openings today|immediate availability/i);
    assert.match(h, /data-acquisition-age-range/);
    assert.match(h, /data-acquisition-format/);
    assert.match(h, /data-portrait-fit="contain"/);
    assert.match(h, /data-hero-treatment="green-blend"/);
  }
});

test('couples navigation and existing-client sign-in stay separate from clinician acquisition actions', () => {
  const emily = output('emily-johnsrud-bio'), autumnHtml = output('autumn-alexander');
  const secondary = emily.match(/<div class="acquisition-secondary"[\s\S]*?<\/div>/)?.[0];
  assert.ok(secondary);
  assert.match(secondary, /href="\/marriage-and-couples-therapy-counseling\/"/);
  assert.doesNotMatch(hero(emily), /couples consultation|data-mft-couples-consultation/);
  assert.doesNotMatch(autumnHtml, /data-mft-couples-consultation=/);
  assert.doesNotMatch(autumnHtml.match(/<div class="acquisition-secondary"[\s\S]*?<\/div>/)?.[0] || '', /couples/);
  for (const html of [emily, autumnHtml]) {
    const returning = anchors(html, 'data-mft-existing-client="true"');
    assert.ok(returning.length >= 3);
    for (const a of returning) {
      assert.equal(href(a), 'https://marriagefamilytherapy.clientsecure.me/sign-in');
      assert.doesNotMatch(a[1], /data-mft-booking=|data-spwidget-|data-acquisition-appointment=/);
    }
  }
});

test('service-page starting costs precede the existing primary action without changing its label or native fields', () => {
  for (const [slug, label, context] of [
    ['new-page','Request an Individual Evaluation','individual'],
    ['marriage-and-couples-therapy-counseling','Request a Couples Consultation','couples']
  ]) {
    const base = read(slug), html = output(slug), h = hero(html);
    const primary = anchors(h, 'data-marketing-appointment="primary"')[0];
    assert.ok(primary);
    assert.equal(plain(primary[2]), label);
    assert.equal(href(primary), 'https://marriagefamilytherapy.clientsecure.me/request');
    assert.match(primary[1], /data-mft-booking="true"/);
    assert.ok(h.indexOf('data-acquisition-payment') < h.indexOf('data-marketing-appointment="primary"'));
    assert.match(html, new RegExp(`id="${context}-starting-costs" data-starting-costs="${context}"`));
    assert.equal(h.match(/<h1>[\s\S]*?<\/h1>/)[0], hero(base).match(/<h1>[\s\S]*?<\/h1>/)[0]);
    assert.match(html, /id="marketing-scheduling-help"/);
  }
  const couples = output('marriage-and-couples-therapy-counseling');
  assert.match(plain(hero(couples)), /Required short couples consultation: \$75 private pay/);
  assert.match(plain(hero(couples)), /26-minute conversation in a 30-minute appointment block/);
  assert.match(plain(hero(couples)), /separate one-hour couples consultation is \$150 private pay/);
  assert.match(couples, /One diagnostic evaluation per partner/);
  assert.match(couples, /53-minute couples sessions/);
  assert.match(couples, /When fear, threats, coercion, or abuse are present/);
});

test('Washington online page connects costs and the individual journey without selecting a clinician or service', () => {
  const html = output('online-therapy-washington'), h = hero(html);
  assert.match(h, /href="\/how-to-start-therapy\/#starting-costs"/);
  assert.match(h, /href="\/how-to-start-therapy\/#individual-journey"/);
  assert.match(h, /href="\/check-my-coverage\/"/);
  assert.match(plain(h), /Confirm telehealth eligibility, clinician, service, and appointment options/);
  assert.doesNotMatch(h, /data-mft-clinician=|clinicianId=|serviceId=|locationId=/);
  const primary = anchors(h, 'data-acquisition-appointment="primary"')[0];
  assert.equal(href(primary), 'https://marriagefamilytherapy.clientsecure.me/request');
  assert.match(primary[1], /data-mft-booking="true"/);
  assert.match(html, /id="online-starting-costs" data-starting-costs="individual"/);
});

test('clinical prose, portraits, page metadata and accessible link targets survive composition', () => {
  for (const slug of acquisition.routes) {
    const base = read(slug), html = output(slug);
    for (const pattern of [/<title>[\s\S]*?<\/title>/, /<link rel="canonical"[^>]*>/, /<meta name="description"[^>]*>/]) {
      assert.equal(html.match(pattern)?.[0], base.match(pattern)?.[0], slug);
    }
    assert.equal((html.match(/<h1\b/g) || []).length, 1, slug);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(ids.length, new Set(ids).size, 'duplicate IDs on ' + slug);
    for (const a of anchors(html, 'aria-describedby=')) {
      for (const id of a[1].match(/aria-describedby="([^"]+)"/)[1].split(/\s+/)) assert.ok(ids.includes(id), `${slug}: ${id}`);
    }
    const addedForms = (html.match(/<(?:form|input|textarea)\b/g) || []).length - (base.match(/<(?:form|input|textarea)\b/g) || []).length;
    assert.equal(addedForms, 0, slug);
    assert.deepEqual(html.match(/<script\b[^>]*src="[^"]+"[^>]*>/g), base.match(/<script\b[^>]*src="[^"]+"[^>]*>/g), slug);
  }
  const autumnText = textContent(output('autumn-alexander'));
  for (const section of autumn.sections) {
    for (const text of section.paragraphs) assert.ok(autumnText.includes(text), text);
  }
  for (const entry of [...autumn.therapyFor, ...autumn.approaches]) assert.ok(autumnText.includes(entry.text), entry.heading);
  assert.match(textContent(output('emily-johnsrud-bio')), /Emily works with children ages 6\+, teens, adults, couples, and families navigating emotional, relational, and life-transition concerns\./);
});

test('missing approved page composition fails before a mismatched acquisition path can be published', () => {
  const empty = '<html><head></head><body><main></main></body></html>';
  for (const slug of acquisition.contentRoutes) assert.throws(() => acquisition.apply(empty, slug), /requires/);
  for (const slug of ['how-to-start-therapy', 'check-my-coverage']) {
    const html = acquisition.apply(empty, slug);
    assert.match(html, /acquisition-ux\.css/);
    assert.equal(html.replace(/<link rel="stylesheet"[^>]*>/, '').replace(' data-acquisition-ux="20261125"', '').replace(` data-acquisition-route="${slug}"`, ''), empty);
  }
});
