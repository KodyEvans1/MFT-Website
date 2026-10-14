'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../src/booking-core');
const config = require('../content/simplepractice-booking.json');

test('general fallback preserves practice-wide selection rather than defaulting to owner', () => {
  const url = new URL(core.destination(config, null));
  assert.equal(url.searchParams.get('scopeGlobal'), 'true');
  assert.equal(url.searchParams.get('clinicianId'), null);
  assert.ok('data-spwidget-scope-global' in core.attributes(config, null));
});

test('clinician fallbacks stay specific and do not acquire the practice-wide flag', () => {
  for (const clinician of config.clinicians) {
    const url = new URL(core.destination(config, clinician));
    assert.equal(url.searchParams.get('clinicianId'), clinician.id);
    assert.equal(url.searchParams.get('scopeGlobal'), null);
  }
});

test('CSP permits the actual redirected widget origin without a wildcard or unsafe script relaxation', () => {
  const headers = fs.readFileSync(path.join(__dirname, '../dist/_headers'), 'utf8');
  const csp = headers.match(/Content-Security-Policy: ([^\n]+)/)[1];
  const directives = Object.fromEntries(csp.split(';').map(d => d.trim().split(/\s+/)).filter(d => d[0]).map(([name,...v]) => [name,v]));
  assert.deepEqual(directives['frame-src'], [
    'https://clientsecure.me',
    'https://marriagefamilytherapy.clientsecure.me',
    'https://spwidget-marriagefamilytherapy.clientsecure.me'
  ]);
  assert.deepEqual(directives['script-src'], ["'self'", 'https://widget-cdn.simplepractice.com']);
  assert.deepEqual(directives['connect-src'], ["'self'", 'https://clientsecure.me', 'https://marriagefamilytherapy.clientsecure.me']);
  assert.match(headers, /Referrer-Policy: no-referrer/);
});
