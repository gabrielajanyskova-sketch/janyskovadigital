import test from 'node:test';
import assert from 'node:assert/strict';
import { cached } from '../lib/api.js';
import { assertPublicHost, isPrivateIPv6, normalizeUrl } from '../lib/http.js';
import { onRequestGet as speed } from '../functions/api/speed.js';

test('cache coalesces concurrent identical work and frees failed jobs for retries', async () => {
  let release, calls = 0;
  const gate = new Promise(r => { release = r; });
  const compute = async () => { calls++; await gate; return { result: 42 }; };
  const jobs = Array.from({ length: 8 }, () => cached('https://test.cz/__cache/shared', compute));
  await Promise.resolve(); release();
  const values = await Promise.all(jobs);
  assert.equal(calls, 1);
  assert(values.every(v => v.data.result === 42));
  await assert.rejects(cached('https://test.cz/__cache/fail', async () => { throw new Error('failed'); }));
  assert.equal((await cached('https://test.cz/__cache/fail', async () => 7)).data, 7);
});
test('cache outages and malformed cache JSON do not hide a successful computation', async () => {
  const original = globalThis.caches;
  const warn = console.warn; console.warn = () => {};
  try {
    for (const mode of ['offline', 'invalid']) {
      globalThis.caches = { default: {
        match: async () => { if (mode === 'offline') throw new Error('offline'); return new Response('not-json'); },
        put: async () => { throw new Error('storage unavailable'); },
      } };
      assert.equal((await cached(`https://test.cz/__cache/${mode}`, async () => 42)).data, 42);
    }
  } finally { globalThis.caches = original; console.warn = warn; }
});
test('cache version and size bound protect cold and repeated runs', async () => {
  let release;
  const gate = new Promise(r => { release = r; });
  const jobs = Array.from({ length: 8 }, (_, i) => cached(`https://test.cz/__cache/busy-${i}`, () => gate));
  try {
    await assert.rejects(cached('https://test.cz/__cache/overflow', async () => 1), { status: 503 });
  } finally { release(1); await Promise.all(jobs); }
  const original = globalThis.caches;let key;
  try {
    globalThis.caches = { default: { match: async request => { key = request.url; return Response.json(42); } } };
    assert.equal((await cached('https://test.cz/__cache/example', async () => 0)).data, 42);
    assert.match(key, /\/__cache\/v2\//);
  } finally { globalThis.caches = original; }
});
test('DNS rejects inconsistent NXDOMAIN replies and malformed answers', async () => {
  for (const broken of [{ Status: 3 }, { Status: 0, Answer: {} }]) {
    await assert.rejects(assertPublicHost('example.com', async u => Response.json(new URL(u).searchParams.get('type') === 'AAAA' ? broken : { Status: 0, Answer: [{ type: 1, data: '93.184.216.34' }] })));
  }
  assert(isPrivateIPv6('2001:2::1'));
  assert(isPrivateIPv6('3fff:fff::1'));
  assert.equal(isPrivateIPv6('2606:4700:4700::1111'), false);
});
test('missing PSI key is explicit and causes no outbound Google request', async () => {
  const original = globalThis.fetch;let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('network should not run'); };
  try {
    const response = await speed({ request: new Request('https://test.cz/api/speed?url=https://example.com/', { headers: { 'cf-connecting-ip': 'missing-psi-key-test' } }), env: {} });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /nakonfigurované/);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});

test('audit deadline aborts outbound work and labels unavailable follow-up checks', async () => {
  const { audit } = await import('../lib/audit.js');
  let aborted = 0;
  const report = await audit('https://example.com/', { checkHost: false, deadlineMs: 20, fetchImpl: async (url, { signal } = {}) => {
    if (url === 'https://example.com/') return new Response('<html><head><title>Firma</title></head><body><h1>Firma</h1></body></html>', { headers: { 'content-type': 'text/html' } });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(new Response('late')), 500);
      signal.addEventListener('abort', () => { clearTimeout(timer); aborted++; reject(signal.reason); }, { once: true });
    });
  } });
  assert(aborted > 0);
  assert.equal(report.incomplete, true);
  for (const id of ['coverage', 'sitemap', '404', 'security-txt']) assert.equal(report.checks.find(c => c.id === id).status, 'info', id);
});

test('credential query parameters are rejected before passing a URL to Google', () => {
  for (const name of ['access_token', '%61pi_key', 'PASSWORD', 'id_token', 'refresh_token', 'secret', 'authorization']) {
    assert.throws(() => normalizeUrl(`https://example.com/?${name}=sensitive`), /bez těchto údajů/);
  }
  assert.equal(normalizeUrl('https://example.com/?page=2').search, '?page=2');
});

test('heavy audits have a separate concurrency cap and release slots', async () => {
  let release;const gate = new Promise(r => { release = r; });
  const first = cached('https://test.cz/__cache/audit?url=1', () => gate);
  const second = cached('https://test.cz/__cache/audit?url=2', () => gate);
  try { await assert.rejects(cached('https://test.cz/__cache/audit?url=3', async () => 0), { status: 503 }); }
  finally { release(1);await Promise.all([first, second]); }
  assert.equal((await cached('https://test.cz/__cache/audit?url=3', async () => 2)).data, 2);
});
