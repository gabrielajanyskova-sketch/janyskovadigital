import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, assertPublicHost, isPrivateIPv4, isPrivateIPv6, fetchPage } from '../testwebu/lib/http.js';
import { parseRobots } from '../testwebu/lib/audit.js';
import { rateLimited, requestBody } from '../functions/_lib/security.js';
import { runPsi } from '../testwebu/lib/psi.js';
import { handleError } from '../testwebu/lib/api.js';
import { onRequestPost } from '../functions/api/contact.js';

const dns = (host, type = 'A', ip = '93.184.216.34') => Response.json({ Status: 0, Answer: type === 'A' ? [{ type: 1, data: ip }] : [] });

test('SSRF: reject dangerous URL representations', async t => {
  for (const value of ['http://127.0.0.1','http://2130706433','http://0x7f000001','http://0177.0.0.1','http://127.1','http://localhost.','http://secret.internal/','http://[::1]','http://10.0.0.1','http://169.254.169.254/','http://192.168.1.1','http://100.64.0.1','http://198.18.0.1','http://224.0.0.1','http://user:pass@example.com','http://example.com:8080','file:///etc/passwd','ftp://example.com']) {
    await t.test(value, () => assert.throws(() => normalizeUrl(value)));
  }
  assert.equal(normalizeUrl('example.com.').hostname, 'example.com');
  assert.equal(normalizeUrl('https://example.com/path#hash').href, 'https://example.com/path');
});

test('SSRF: IPv4 and IPv6 private/mapped/reserved addresses', () => {
  for (const ip of ['::','::1','0:0:0:0:0:0:0:1','::ffff:127.0.0.1','::ffff:7f00:1','fc00::1','fe80::1','2001:db8::1','2002:7f00:1::','invalid']) assert.equal(isPrivateIPv6(ip), true, ip);
  assert.equal(isPrivateIPv6('2606:4700:4700::1111'), false);
  for (const ip of ['999.1.1.1','192.0.2.1','198.51.100.1','203.0.113.1']) assert.equal(isPrivateIPv4(ip), true, ip);
  assert.equal(isPrivateIPv4('93.184.216.34'), false);
});

test('SSRF: DNS fails closed including partial failure, private AAAA and no records', async t => {
  const cases = [
    async () => { throw new Error('offline'); },
    async u => new URL(u).searchParams.get('type') === 'AAAA' ? new Response('', { status: 500 }) : dns(),
    async () => Response.json({ Status: 0, Answer: [] }),
    async () => Response.json({ Status: 0, Answer: [{ type: 28, data: '::ffff:7f00:1' }] }),
    async () => Response.json({ Status: 0, Answer: [{ type: 1, data: '10.0.0.1' }] }),
    async () => Response.json({ Status: 3 }),
    async () => Response.json({ Status: 2 }),
  ];
  for (let i = 0; i < cases.length; i++) await t.test(`case ${i}`, () => assert.rejects(() => assertPublicHost('example.com', cases[i])));
});

test('SSRF: verify first hostname; reject private sitemap-like URL before fetching it', async () => {
  let targets = 0;
  const result = await fetchPage('https://private.example.com/sitemap.xml', { fetchImpl: async u => {
    if (u.startsWith('https://cloudflare-dns.com/')) return Response.json({ Status: 0, Answer: [{ type: 1, data: '10.0.0.1' }] });
    targets++; return new Response('private');
  } });
  assert.equal(result.error, 'blocked'); assert.equal(targets, 0);
});

test('SSRF: private redirect is never followed; public host verified before request', async () => {
  const calls = [];
  const result = await fetchPage('https://public.example.com/', { fetchImpl: async u => {
    calls.push(u);
    if (u.startsWith('https://cloudflare-dns.com')) return dns(null, new URL(u).searchParams.get('type'));
    assert.equal(u, 'https://public.example.com/');
    return new Response(null, { status: 302, headers: { Location: 'http://169.254.169.254/latest/meta-data/' } });
  } });
  assert.equal(result.error, 'blocked'); assert.equal(calls.length, 3);
});

test('fetch: stream failure is a result; malformed redirect and size limit handled', async () => {
  const stream = await fetchPage('https://example.com', { checkHost: false, fetchImpl: async () => new Response(new ReadableStream({ start(c) { c.error(new DOMException('Timed out', 'TimeoutError')); } })) });
  assert.equal(stream.error, 'timeout');
  const redirect = await fetchPage('https://example.com', { checkHost: false, fetchImpl: async () => new Response(null, { status: 302, headers: { Location: 'http://[' } }) });
  assert.equal(redirect.ok, false);
  const big = await fetchPage('https://example.com', { checkHost: false, fetchImpl: async () => new Response('x'.repeat(4 * 1024 * 1024)) });
  assert(big.body.length <= 3 * 1024 * 1024);
});

test('limits: threshold, separate services, expiry and binding outage', async () => {
  const req = new Request('https://example.com', { headers: { 'cf-connecting-ip': 'test-limits-1' } });
  const opts = { binding: 'TEST_LIMITER', limit: 3, windowMs: 600000, now: 1000 };
  for (let i = 0; i < 3; i++) assert.equal(await rateLimited({}, req, opts), false);
  assert.equal(await rateLimited({}, req, opts), true);
  assert.equal(await rateLimited({}, req, { ...opts, binding: 'OTHER' }), false);
  assert.equal(await rateLimited({}, req, { ...opts, now: 601001 }), false);
  assert.equal(await rateLimited({ TEST_LIMITER: { limit: async () => { throw new Error('down'); } } }, req, opts), true);
});

test('body limit: chunked request cannot bypass missing Content-Length', async () => {
  const req = new Request('https://example.com', { method: 'POST', body: 'x'.repeat(4097) });
  await assert.rejects(() => requestBody(req, 4096), { status: 413 });
});

test('contact: binding rejects before Siteverify or mail; oversized form is 413', async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('unexpected network'); };
  try {
    let response = await onRequestPost({ request: new Request('https://example.com/api/contact', { method: 'POST', headers: { Accept: 'application/json' } }), env: { CONTACT_LIMITER: { limit: async () => ({ success: false }) } } });
    assert.equal(response.status, 429); assert.equal(calls, 0);
    response = await onRequestPost({ request: new Request('https://example.com/api/contact', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'x'.repeat(65537) }), env: { CONTACT_LIMITER: { limit: async () => ({ success: true }) } } });
    assert.equal(response.status, 413); assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});

test('robots: merge repeated groups and prefer Allow on equal path', () => {
  assert(!parseRobots('User-agent: Googlebot\nDisallow: /\n\nUser-agent: Googlebot\nAllow: /').searchBlocked.includes('Googlebot'));
  assert(parseRobots('User-agent: *\nDisallow: /').searchBlocked.includes('Googlebot'));
});

test('PSI: malformed response is handled and only fields errors retry once', async () => {
  let calls = 0;
  const result = await runPsi('https://example.com', 'mobile', { fetchImpl: async () => { calls++; return new Response('not-json', { status: 400 }); } });
  assert(result.error); assert.equal(calls, 1);
  calls = 0;
  const retry = await runPsi('https://example.com', 'mobile', { fetchImpl: async () => { calls++; return Response.json({ error: { message: 'Invalid fields parameter' } }, { status: 400 }); } });
  assert(retry.error); assert.equal(calls, 2);
});

test('public API does not disclose internal exception text', async () => {
  const old = console.error; console.error = () => {};
  try { const data = await handleError(new Error('internal-sensitive-detail')).json(); assert(!JSON.stringify(data).includes('internal-sensitive-detail')); }
  finally { console.error = old; }
});
