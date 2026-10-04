'use strict';
// Keep expansion templates unchanged. Apply the bounded Plaud first-page edits
// only after generation, before the normal validators run.
require('./seo-expansion-engine');
const fs = require('node:fs');
const path = require('node:path');
const {applyPlaudEdits} = require('./start-page');
const {decorateHtml} = require('./booking-build');
const root = path.resolve(__dirname,'..');
const dist = path.join(root,'dist');
const bookingFile = path.join(dist,'reports/booking-integration.json');
const booking = JSON.parse(fs.readFileSync(bookingFile,'utf8'));
const updates = [];
for (const route of ['/how-to-start-therapy/', '/', '/marriagereset/']) {
  const file = path.join(dist, route.replace(/^\/+|\/+$/g,''), 'index.html');
  const before = fs.readFileSync(file,'utf8');
  const result = decorateHtml(applyPlaudEdits(before,route),route);
  fs.writeFileSync(file,result.html);
  const row = booking.pages.find(p => p.route === route);
  if (!row) throw new Error('Missing booking inventory for edited page: ' + route);
  row.buttons = result.buttons; row.widget = result.widget;
  updates.push({route, changed: before !== result.html, appointmentButtons: result.buttons});
}
fs.writeFileSync(bookingFile,JSON.stringify(booking,null,2)+'\n');
fs.appendFileSync(path.join(dist,'assets/styles.css'),fs.readFileSync(path.join(root,'src/assets/start-page.css'),'utf8'));
fs.writeFileSync(path.join(dist,'reports/plaud-page-edits.json'),JSON.stringify({version:1,recordingDate:'2026-10-02',updates,productionRelease:false},null,2)+'\n');
console.log(JSON.stringify({plaudPageEdits:updates}));
