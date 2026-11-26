'use strict';

// Fixture-only behavior checks for the production booking script. The VM does
// not navigate a browser or deliver analytics; real tab visibility is verified
// separately by the isolated browser regression.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../src/booking-core');
const config = require('../content/simplepractice-booking.json');
const SCHEDULER = 'https://marriagefamilytherapy.clientsecure.me/request';
const source = fs.readFileSync(path.join(__dirname, '../src/assets/mft-booking.js'), 'utf8');

function fixture({remembered = true} = {}) {
  const calls = [], documentListeners = new Map(), windowListeners = new Map(), timers = new Map();
  const values = new Map(remembered ? [['mft.newClientAccountAcknowledgment.v1', 'acknowledged']] : []);
  let now = 1_800_000_000_000, timerId = 0;
  const storage = {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value))};
  function listen(map, name, fn, capture = false) {
    const entries = map.get(name) || [];
    entries.push({fn, capture: Boolean(capture)});
    map.set(name, entries);
  }
  function element(tag, initial = {}, parent = null) {
    const attributes = new Map(), handlers = new Map();
    const node = {
      dataset: {}, handlers, isConnected: true, checked: false, hidden: false, textContent: '',
      addEventListener: (name, fn) => listen(handlers, name, fn),
      getAttribute: key => attributes.get(key) ?? null,
      hasAttribute: key => attributes.has(key),
      setAttribute(key, value) {
        attributes.set(key, String(value));
        if (key.startsWith('data-')) node.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
      },
      removeAttribute(key) { attributes.delete(key); if (key === 'href') node.href = ''; },
      focus() {},
      closest(selector) {
        if (selector.startsWith('a[')) return tag === 'a' && attributes.has('data-mft-booking') ? node : null;
        if (selector === '.mft-consultation-gate') return parent;
        return null;
      }
    };
    for (const [key, value] of Object.entries(initial)) node.setAttribute(key, value);
    return node;
  }
  const anchor = element('a', {'data-mft-booking-intent': 'appointment'});
  anchor.href = config.generalUrl;
  anchor.textContent = 'Request an appointment';
  const dialog = element('dialog'), account = element('input'), consultation = element('input');
  const go = element('a', {}, dialog), cancel = element('button'), close = element('button'), form = element('form');
  const parts = {
    '[data-mft-account-ack]': account, '[data-mft-consultation-ack]': consultation,
    '[data-mft-account-section]': element('section'), '[data-mft-consultation-section]': element('section'),
    h2: element('h2'), '[data-consultation-continue]': go, form
  };
  dialog.querySelector = selector => parts[selector];
  dialog.querySelectorAll = () => [cancel, close];
  dialog.contains = node => node === go;
  dialog.open = false;
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => {
    dialog.open = false;
    for (const {fn} of dialog.handlers.get('close') || []) fn();
  };
  const document = {
    visibilityState: 'visible',
    querySelectorAll: () => [anchor], createElement: () => dialog, getElementById: () => null,
    body: {appendChild() {}}, documentElement: {classList: {add() {}, remove() {}}},
    addEventListener: (name, fn, capture) => listen(documentListeners, name, fn, capture)
  };
  const context = {
    document, MFT_BOOKING_CONFIG: config, MFTBookingCore: core, location: {pathname: '/'}, localStorage: storage,
    MFTSchedulingMeasurement: {track: (...args) => calls.push(args)},
    HTMLDialogElement: function () {},
    addEventListener: (name, fn, capture) => listen(windowListeners, name, fn, capture),
    setTimeout(fn, delay = 0) { const id = ++timerId; timers.set(id, {fn, due: now + Number(delay)}); return id; },
    clearTimeout: id => timers.delete(id),
    Date: class extends Date { static now() { return now; } }
  };
  context.HTMLDialogElement.prototype.showModal = function () {};
  context.window = context;
  vm.runInNewContext(source, context, {filename: 'mft-booking.js'});

  function activate(target = anchor, extra = {}) {
    const event = {
      type: 'click', target, isTrusted: true, button: 0, defaultPrevented: false, stopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopImmediatePropagation() { this.stopped = true; }, ...extra
    };
    const entries = documentListeners.get(event.type) || [];
    for (const {fn} of entries.filter(item => item.capture)) { fn(event); if (event.stopped) return event; }
    for (const {fn} of target.handlers.get(event.type) || []) { fn(event); if (event.stopped) return event; }
    for (const {fn} of entries.filter(item => !item.capture)) { fn(event); if (event.stopped) return event; }
    return event;
  }
  function fire(map, name, extra = {}) {
    for (const {fn} of map.get(name) || []) fn({type: name, isTrusted: true, ...extra});
  }
  function visibility(state, isTrusted = true) {
    document.visibilityState = state;
    fire(documentListeners, 'visibilitychange', {isTrusted});
  }
  function advance(milliseconds) {
    now += milliseconds;
    for (const [id, timer] of [...timers]) if (timer.due <= now) { timers.delete(id); timer.fn(); }
  }
  function acknowledge() {
    account.checked = true;
    consultation.checked = true;
    fire(account.handlers, 'change');
    fire(consultation.handlers, 'change');
  }
  return {
    anchor, dialog, go, document, storage, activate, visibility, advance, acknowledge,
    windowEvent: (name, extra) => fire(windowListeners, name, extra),
    handoffs: () => calls.filter(args => args[0].includes('simplepractice_exit'))
  };
}

test('repeated native activations while the source remains visible count once and keep every native navigation usable', () => {
  const f = fixture();
  for (const options of [{ctrlKey: true}, {type: 'auxclick', button: 1}, {}]) {
    const event = f.activate(f.anchor, options);
    assert.equal(event.defaultPrevented, false);
    assert.equal(f.anchor.href, SCHEDULER);
    assert.equal(f.document.visibilityState, 'visible');
  }
  assert.equal(f.handoffs().length, 1);
  assert.equal(f.dialog.open, false);
});

test('a trusted hidden-to-visible return permits one new activation without measuring the return itself', () => {
  const f = fixture();
  f.activate();
  f.visibility('hidden');
  assert.equal(f.handoffs().length, 1);
  f.visibility('visible');
  assert.equal(f.handoffs().length, 1, 'a return is not a scheduler handoff');
  assert.equal(f.activate().defaultPrevented, false);
  assert.equal(f.handoffs().length, 2);
  f.activate(f.anchor, {type: 'auxclick', button: 1});
  f.activate(f.anchor, {ctrlKey: true});
  assert.equal(f.handoffs().length, 2, 'the new visible visit retains duplicate protection');
});

test('focus, elapsed time and visible notifications without a hidden interval do not start another handoff', () => {
  const f = fixture();
  f.activate();
  f.windowEvent('blur');
  f.windowEvent('focus');
  f.visibility('visible');
  f.windowEvent('pageshow', {persisted: false});
  f.advance(24 * 60 * 60 * 1000);
  f.activate();
  assert.equal(f.handoffs().length, 1);
});

test('synthetic visibility events cannot release native-link duplicate protection', () => {
  const f = fixture();
  f.activate();
  f.visibility('hidden', false);
  f.visibility('visible');
  f.activate();
  assert.equal(f.handoffs().length, 1, 'an untrusted hidden notification is not an observed return');
  f.visibility('hidden');
  f.visibility('visible', false);
  f.activate();
  assert.equal(f.handoffs().length, 1, 'an untrusted visible notification cannot release the prior handoff');
  f.visibility('visible');
  f.activate();
  assert.equal(f.handoffs().length, 2);
});

test('BFCache restoration begins a fresh visit and consumes the preceding hidden interval', () => {
  const f = fixture();
  f.activate();
  f.visibility('hidden');
  f.document.visibilityState = 'visible';
  f.windowEvent('pageshow', {persisted: true});
  f.activate();
  assert.equal(f.handoffs().length, 2);
  f.visibility('visible');
  f.activate();
  assert.equal(f.handoffs().length, 2, 'a late visible notification cannot release the restored visit twice');
});

test('a return cannot count a completed dialog again or count its acknowledgment', () => {
  const f = fixture({remembered: false});
  assert.equal(f.activate().defaultPrevented, true);
  assert.equal(f.dialog.open, true);
  f.acknowledge();
  assert.equal(f.handoffs().length, 0);
  assert.equal(f.activate(f.go).defaultPrevented, false);
  assert.equal(f.handoffs().length, 1);
  // Hold the queued close task in this fixture to exercise the same completed
  // dialog across a return; do not substitute a second dialog/action.
  f.visibility('hidden');
  f.visibility('visible');
  assert.equal(f.handoffs().length, 1);
  assert.equal(f.activate(f.go).defaultPrevented, false);
  assert.equal(f.go.href, SCHEDULER);
  assert.equal(f.handoffs().length, 1);
  f.advance(0);
  assert.equal(f.dialog.open, false);
  assert.equal(f.storage.getItem('mft.newClientAccountAcknowledgment.v1'), 'acknowledged');
});
