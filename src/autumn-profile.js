'use strict';
// Owner-supplied biography rendered within the existing M.F.T. profile system.
const profile = require('../content/autumn-profile.json');
const {esc} = require('./ui/home-components');
const scheduling = require('./scheduling-actions');
const booking = require('./autumn-booking');
const paragraphs = items => items.map(text => `<p>${esc(text)}</p>`).join('');
const entries = items => items.map(item => `<section class="experience-prose"><h3>${esc(item.heading)}</h3><p>${esc(item.text)}</p></section>`).join('');
function apply(html) {
  const source = /<section class="section clinician-story">[\s\S]*?<\/section>/;
  if (!source.test(html)) throw new Error('Autumn profile source shell changed');
  const main = profile.sections.map(section => `<section class="experience-prose"><h2>${esc(section.heading)}</h2>${paragraphs(section.paragraphs)}</section>`).join('');
  const body = `<section class="section experience-body" data-experience-body="${profile.slug}" aria-label="Get to know Autumn Alexander"><div class="experience-reading">${main}<section class="experience-prose"><h2>Therapy for</h2>${entries(profile.therapyFor)}</section><section class="experience-prose"><h2>Approaches</h2>${entries(profile.approaches)}</section><section class="experience-prose" id="autumn-appointments"><h2>Request an appointment with Autumn</h2><p>${esc(profile.booking.note)}</p><p>${booking.button("experience-inline")}</p></section><aside class="mft-care-note" aria-label="Urgent support"><p>${esc(profile.urgentNote)}</p></aside></div><aside class="experience-sidebar"><p class="kicker">Autumn's focus areas</p><h2>Support shaped around the person.</h2><ul>${profile.focusAreas.map(item => `<li>${esc(item)}</li>`).join('')}</ul><p>Children ages 6+, teens, young adults, and adults.</p><p>Her background includes intensive family support services. Ask about the service and participation that fit your needs.</p><a class="experience-inline" href="${esc(profile.booking.contactUrl)}">Contact the practice</a></aside></section>`;
  // The authored bio replaces the generic duplicate facts/focus sections, not other pages.
  return html.replace(source, body)
    .replace(/<aside class="mft-schedule-shortcuts"[\s\S]*?<\/aside>/, `<aside class="mft-schedule-shortcuts" data-scheduling-actions="20261029" aria-label="Existing client scheduling">${scheduling.existingButton()}</aside>`)
    .replace(/<div class="mft-footer-scheduling">[\s\S]*?<\/p><\/div>/, `<div class="mft-footer-scheduling"><h2>Request an appointment with Autumn</h2><div class="actions">${booking.button("mft-schedule-button")}${scheduling.existingButton()}</div><p>Choose the appropriate service in SimplePractice. Requests are not confirmed appointments until accepted by the practice.</p></div>`)
    .replace(/<dl class="facts">[\s\S]*?<\/dl>/g, '')
    .replace(/<section class="section focus-section reveal">[\s\S]*?<\/section>/g, '')
    .replace(/<section class="section action-band">[\s\S]*?<\/section>/g, '');
}
module.exports = {apply};
