import test from 'node:test';
import assert from 'node:assert/strict';
import { a11yChecks, speedChecks, lighthouseChecks, score } from '../lib/checks.js';
import { checkStatusLabel, explanationCopy } from '../src/check-copy.js';

const good = () => ({
  scores: { performance: 100, accessibility: 100, bestPractices: 100, seo: 100 },
  failedAccessibility: [], failedBestPractices: [], failedSeo: [],
  metrics: { lcp: { value: 1200 }, cls: { value: 0.01 }, tbt: { value: 100 } },
  opportunities: [],
});

test('passing automated checks do not tell visitors to repair nonexistent errors', () => {
  const checks = [...a11yChecks(good()), ...speedChecks('mobile', good()), ...lighthouseChecks(good())];
  for (const check of checks.filter(check => check.status === 'pass')) {
    assert.equal(explanationCopy(check).action, null, check.id);
  }
  const accessibility = checks.find(check => check.id === 'a11y-score');
  assert.match(accessibility.detail, /nenašla chyby v bodech/);
  assert.match(accessibility.why, /musí vyzkoušet člověk/);
  assert.doesNotMatch(accessibility.why, /WCAG|zákon/);
  assert.deepEqual(score(checks), { speed: 100, seo: 100, security: 100, a11y: 100 });
});

test('warnings and incomplete results keep useful next steps and distinct labels', () => {
  const psi = good();
  psi.metrics.lcp.value = 3500;
  psi.failedAccessibility = ['Text nemá dostatečný kontrast'];
  psi.scores.accessibility = 80;
  const warning = speedChecks('mobile', psi).find(check => check.id === 'lcp');
  assert.equal(checkStatusLabel(warning), 'Ke zlepšení');
  assert.equal(explanationCopy(warning).actionLabel, 'Jak postupovat: ');
  assert.ok(explanationCopy(warning).action);
  const accessibility = a11yChecks(psi)[0];
  assert.match(accessibility.detail, /Text nemá dostatečný kontrast/);
  assert.ok(explanationCopy(accessibility).action);
  const unavailable = speedChecks('mobile', { error: 'Google neodpověděl.' })[0];
  assert.equal(checkStatusLabel(unavailable), 'Neověřeno');
  assert.deepEqual(score([unavailable]), {});
  assert.equal(checkStatusLabel({ status: 'info', title: 'Web má soubor llms.txt' }), 'Informace');
  assert.equal(explanationCopy({ status: 'info', fix: '—' }).action, null);
});
