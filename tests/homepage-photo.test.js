'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
test('Homepage lobby crop anchors to the right to preserve the complete wall logo', () => {
  const css = fs.readFileSync(path.join(__dirname, '../src/assets/homepage-refresh.css'), 'utf8');
  assert.match(css, /\.mh-photo-frame \.mh-lobby\{[^}]*object-position:100% 50%/);
  assert.doesNotMatch(css, /object-position:50% 55%/);
  const html = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');
  assert.match(html, /1cbcf430-dfe2-4b69-9d9f-7ac53733849e/);
  assert.doesNotMatch(html, /find_the_right_therapist\.png/);
});
