import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

test('heading fonts really are WOFF2 and preserve a smaller delivery format', async () => {
  for (const style of ['regular', 'italic']) {
    const optimized = await readFile(`fonts/dm-serif-display-cs-${style}.woff2`);
    const original = await readFile(`fonts/dm-serif-display-latin-${style}.woff2`);
    assert.equal(optimized.subarray(0, 4).toString(), 'wOF2');
    assert.ok(optimized.length < original.length / 2);
  }
});

test('Turnstile waits for the form, starts only once and still blocks unverified submission', async () => {
  const handlers = new Map();
  let observed;
  let configRequests = 0;
  let rendered = 0;
  const observer = class {
    constructor(callback) { observed = callback; }
    observe() {}
    disconnect() {}
  };
  const form = {
    action: 'https://janyskovadigital.cz/api/contact', dataset: {},
    querySelector: () => ({ before() {} }),
    addEventListener: (event, handler) => handlers.set(event, handler),
  };
  const source = (await readFile('src/js/turnstile.js', 'utf8'))
    .replace(/^import .*;\n/gm, '').replace('export function resetTurnstile', 'function resetTurnstile');
  runInNewContext(source, {
    window: { IntersectionObserver: observer, turnstile: { render() { rendered++; return 'test-widget'; } } },
    IntersectionObserver: observer,
    document: { querySelectorAll: () => [form], createElement: () => ({ setAttribute() {} }) },
    URL,
    FormData: class { get() { return ''; } },
    withTimeout: async (_milliseconds, operation) => operation(undefined),
    fetch: async () => { configRequests++; return { ok: true, json: async () => ({ sitekey: 'test-key' }) }; },
  });
  assert.equal(configRequests, 0);
  let blocked = false;
  handlers.get('submit')({ preventDefault() { blocked = true; }, stopImmediatePropagation() {} });
  assert.equal(blocked, true);
  observed([{ isIntersecting: false }]);
  assert.equal(configRequests, 0);
  handlers.get('focusin')();
  observed([{ isIntersecting: true }]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(configRequests, 1);
  assert.equal(rendered, 1);
  assert.equal(form.dataset.turnstileId, 'test-widget');
});
