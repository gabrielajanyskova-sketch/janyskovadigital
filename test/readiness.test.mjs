import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { estimateReadiness, formatEstimate } from '../src/js/readiness-estimate.js';

const catalogue = JSON.parse(await readFile(new URL('../src/data/schema-business.json', import.meta.url)));
const base = { goal: 0, scope: 0, features: 0, content: 0, logo: 0 };

test('readiness: scope and required commerce features select the appropriate offer', () => {
  assert.equal(formatEstimate(estimateReadiness(base, catalogue)), 'od 5\u00a0900 Kč');
  assert.equal(formatEstimate(estimateReadiness({ ...base, scope: 1 }, catalogue)), '12\u00a0000–20\u00a0000 Kč');
  for (const selection of [{ goal: 1 }, { scope: 2 }, { features: 2 }]) {
    assert.equal(estimateReadiness({ ...base, ...selection }, catalogue).name, 'E-shop na míru');
  }
  assert.equal(estimateReadiness({ ...base, scope: 3 }, catalogue).provisional, true);
});

test('readiness: missing materials and logo never create an invented surcharge', () => {
  const original = estimateReadiness(base, catalogue);
  for (let logo = 0; logo < 4; logo++) {
    const estimate = estimateReadiness({ ...base, content: 2, logo }, catalogue);
    assert.equal(estimate.min, original.min);
    assert.equal(estimate.max, original.max);
    if (logo === 1) assert.ok(estimate.extras.some(text => text.includes('po posouzení podkladu')));
  }
  const reservation = estimateReadiness({ ...base, goal: 2 }, catalogue);
  assert.ok(reservation.extras.some(text => text.includes('Rezervace')));
});

test('readiness: estimates follow catalogue changes and are available on the preparation page', async () => {
  const changed = structuredClone(catalogue);
  changed.business.hasOfferCatalog.itemListElement.find(offer => offer.itemOffered.name === 'Web Start').price = '6500';
  assert.equal(estimateReadiness(base, changed).min, 6500);
  const page = await readFile(new URL('../src/pages/index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('href="/priprava-webu"'));
  const preparation = await readFile(new URL('../src/pages/priprava-webu.html', import.meta.url), 'utf8');
  assert.ok(preparation.indexOf('<!-- @include readiness -->') < preparation.indexOf('<!-- @include contact'));

});

test('readiness: enquiry fills the message, reveals the contact and scrolls to it', async () => {
  const { runInNewContext } = await import('node:vm');
  const { questions } = await import('../src/js/readiness-data.js');
  const listeners = new Map();
  const nodes = new Map();
  let focused;
  let scrolled;
  let visible = false;
  let hash;
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {
      value: '',
      addEventListener(type, handler) { listeners.set(`${id}:${type}`, handler); },
      querySelectorAll() { return []; },
      querySelector(selector) {
        if (selector === '.reveal') return { classList: { add(value) { visible = value === 'visible'; } } };
        if (selector === 'h3') return node('result-heading');
        return { value: '0' };
      },
      replaceChildren() {},
      append() {},
      reportValidity() { return true; },
      dispatchEvent() {},
      focus(options) { focused = { id, options }; },
      scrollIntoView(options) { scrolled = { id, options }; },
    });
    return nodes.get(id);
  };
  const source = (await readFile(new URL('../src/js/readiness.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\n/gm, '');
  runInNewContext(source, {
    questions, catalogue, estimateReadiness, formatEstimate,
    document: { getElementById: node, createElement: () => node(Symbol()) },
    window: { matchMedia: () => ({ matches: true }) },
    history: { replaceState(_state, _title, url) { hash = url; } },
    Event: class {},
  });
  node('zprava').value = 'Moje poznámka';
  listeners.get('readiness-form:submit')({ preventDefault() {} });
  listeners.get('readiness-contact:click')();
  const message = node('zprava').value;
  assert.ok(message.startsWith('Moje poznámka'));
  assert.ok(message.includes('Moje zadání z testu připravenosti:'));
  assert.equal(visible, true);
  assert.equal(focused.id, 'jmeno');
  assert.equal(focused.options.preventScroll, true);
  assert.equal(scrolled.id, 'kontakt');
  assert.equal(scrolled.options.behavior, 'auto');
  assert.equal(hash, '#kontakt');
  listeners.get('readiness-contact:click')();
  assert.equal(node('zprava').value, message);
  node('jmeno').value = 'Jana';
  listeners.get('readiness-contact:click')();
  assert.equal(focused.id, 'email');
});
