"use strict";
// The owner supplied this clinician mapping on 2026-11-12. No service or slot is preselected.
const core = require('./booking-core');
const config = require('../content/simplepractice-booking.json');
const profile = require('../content/autumn-profile.json');
const {esc} = require('./ui/home-components');
const clinician = core.clinicianForPath(config, '/' + profile.slug + '/');
if (!clinician || clinician.key !== 'autumn') throw new Error('Autumn scheduling configuration is required');
const calendar = core.destination(config, clinician);
function button(className = 'experience-inline mft-autumn-card-action') {
  return `<a class="${esc(className)}" data-mft-clinician="autumn" href="${esc(calendar)}" rel="noopener noreferrer">${esc(profile.booking.label)}</a>`;
}
module.exports = {calendar, button};
