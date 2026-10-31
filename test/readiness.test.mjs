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

test('readiness: estimates follow catalogue changes and sit after the price list', async () => {
  const changed = structuredClone(catalogue);
  changed.business.hasOfferCatalog.itemListElement.find(offer => offer.itemOffered.name === 'Web Start').price = '6500';
  assert.equal(estimateReadiness(base, changed).min, 6500);
  const page = await readFile(new URL('../src/pages/index.html', import.meta.url), 'utf8');
  assert.ok(page.indexOf('id="cenik"') < page.indexOf('<!-- @include readiness -->'));
  assert.ok(page.indexOf('<!-- @include readiness -->') < page.indexOf('<!-- @include contact'));
});
