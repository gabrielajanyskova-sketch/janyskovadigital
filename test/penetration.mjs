// Lokální HTTP test skutečných handlerů. Resend, Siteverify a cizí weby jsou simulované.
// Žádný parametr cíle: tento runner nemůže být omylem namířen na produkci.
import http from 'node:http';
import { Readable } from 'node:stream';
import assert from 'node:assert/strict';
import { onRequestPost as contact } from '../functions/api/contact.js';
import { onRequestGet as config } from '../functions/api/turnstile.js';
import { onRequestPost as audit } from '../testwebu/functions/api/audit.js';
import { onRequestGet as speed } from '../testwebu/functions/api/speed.js';

const originalFetch = globalThis.fetch;
const usedTokens = new Set();
let emails = 0, checked = 0, remoteTargets = [];
const env = { TURNSTILE_SECRET_KEY: 'local-test-secret', RESEND_API_KEY: 'local-test-mail' };
globalThis.fetch = async (input, init) => {
  const url = new URL(input);
  if (url.hostname === 'challenges.cloudflare.com') {
    const { response: token } = JSON.parse(init.body); checked++;
    if (usedTokens.has(token)) return Response.json({ success: false, 'error-codes': ['timeout-or-duplicate'] });
    usedTokens.add(token);
    return Response.json({ success: token.startsWith('valid-') || token === 'wrong-host', action: 'contact', hostname: token === 'wrong-host' ? 'evil.example' : 'janyskovadigital.cz' });
  }
  if (url.hostname === 'api.resend.com') {
    emails++;
    const email = JSON.parse(init.body);
    assert(!email.html.includes('<script>alert'));
    assert.equal(email.to[0], 'info@janyskovadigital.cz');
    assert(!email.subject.includes('\n'));
    return Response.json({ id: 'local-mock' });
  }
  if (url.hostname === 'cloudflare-dns.com') {
    const host = url.searchParams.get('name');
    const ip = host === 'private.example.test' ? '10.0.0.1' : '93.184.216.34';
    return Response.json({ Status: 0, Answer: url.searchParams.get('type') === 'A' ? [{ type: 1, data: ip }] : [] });
  }
  if (['public.example.test', 'www.public.example.test'].includes(url.hostname)) {
    remoteTargets.push(url.href);
    if (url.pathname === '/robots.txt') return new Response('User-agent: *\nSitemap: https://private.example.test/sitemap.xml', { headers: { 'content-type': 'text/plain' } });
    if (url.pathname !== '/') return new Response('not found', { status: 404 });
    return new Response('<html lang="cs"><head><title>Test</title></head><body><h1>Test</h1></body></html>', { headers: { 'content-type': 'text/html' } });
  }
  throw new Error(`Unexpected outbound target: ${url.hostname}`);
};
const server = http.createServer(async (req, res) => {
  try {
    const headers = new Headers(req.headers);
    // Identifikátory klientů pouze v tomto místním harnessu; produkce je nepřebírá.
    headers.set('cf-connecting-ip', headers.get('x-local-client') || 'penetration-client');
    const request = new Request(`https://janyskovadigital.cz${req.url}`, { method: req.method, headers, ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: Readable.toWeb(req), duplex: 'half' }) });
    let result;
    if (req.url === '/api/contact' && req.method === 'POST') result = await contact({ request, env });
    else if (req.url === '/api/turnstile') result = config({ request, env });
    else if (req.url === '/api/audit') result = await audit({ request, env });
    else if (req.url.startsWith('/api/speed')) result = await speed({ request, env });
    else result = new Response('Not found', { status: 404 });
    res.writeHead(result.status, Object.fromEntries(result.headers)); res.end(Buffer.from(await result.arrayBuffer()));
  } catch { res.writeHead(500); res.end('Test adapter error'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let assertions = 0;
const check = (value, expected, name) => { assert.equal(value, expected, name); assertions++; console.log(`PASS ${name}`); };
async function postContact(token, client, extra = {}) {
  const form = new FormData(); form.set('jmeno', 'Local test'); form.set('email', 'test@example.com'); form.set('message', '<script>alert(1)</script>'); form.set('subject', 'Injected\r\nBcc: attacker@example.com');
  if (token) form.set('cf-turnstile-response', token);
  for (const [key, value] of Object.entries(extra)) form.set(key, value);
  return originalFetch(`${origin}/api/contact`, { method: 'POST', headers: { Accept: 'application/json', 'x-local-client': client }, body: form, redirect: 'manual' });
}
try {
  for (const [token, name] of [[null, 'missing-token'], ['forged', 'forged-token'], ['expired', 'expired-token'], ['wrong-host', 'wrong-host']]) check((await postContact(token, name)).status, 400, name);
  check(emails, 0, 'rejected requests send no emails');
  check((await postContact('valid-one', 'valid-one')).status, 200, 'valid token accepted');
  check(emails, 1, 'one verified request sends one escaped email');
  check((await postContact('valid-one', 'replay')).status, 400, 'replay rejected');
  check(emails, 1, 'replay does not resend');
  const before = checked;
  check((await postContact(null, 'honeypot', { botcheck: 'yes' })).status, 200, 'honeypot returns decoy success');
  check(checked, before, 'honeypot does not call verification');
  check(emails, 1, 'honeypot sends nothing');
  for (let i = 0; i < 3; i++) check((await postContact(`valid-limit-${i}`, 'same-limit-client')).status, 200, `limit permits request ${i + 1}`);
  check((await postContact('valid-limit-four', 'same-limit-client')).status, 429, 'fourth contact request rate limited');
  check(emails, 4, 'rate limited request sends nothing');
  check((await originalFetch(`${origin}/api/contact`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'x-local-client': 'oversized' }, body: 'x'.repeat(70000) })).status, 413, 'oversized form rejected via HTTP');
  const publicConfig = await (await originalFetch(`${origin}/api/turnstile`)).json();
  check('sitekey' in publicConfig, true, 'public endpoint exposes site key');
  check(JSON.stringify(publicConfig).includes(env.TURNSTILE_SECRET_KEY), false, 'secret absent from public response');
  for (const [url, client] of [['http://2130706433/', 'ssrf-ip'], ['https://private.example.test/', 'ssrf-dns']]) {
    const response = await originalFetch(`${origin}/api/audit`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-local-client': client }, body: JSON.stringify({ url }) });
    check(response.status < 500 && response.status >= 400, true, client);
  }
  const response = await originalFetch(`${origin}/api/audit`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-local-client': 'ssrf-sitemap' }, body: JSON.stringify({ url: 'https://public.example.test/' }) });
  check(response.status, 200, 'public audit works with malicious external sitemap ignored');
  check(remoteTargets.some(u => u.includes('private.example')), false, 'private sitemap never fetched');
  check((await originalFetch(`${origin}/api/speed?url=http%3A%2F%2F127.0.0.1`, { headers: { 'x-local-client': 'speed-private' } })).status, 400, 'speed rejects private input before Google request');
  check((await originalFetch(`${origin}/api/audit`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-local-client': 'invalid-json' }, body: '{' })).status, 400, 'malformed JSON is a client error');
  check((await originalFetch(`${origin}/api/audit`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-local-client': 'oversized-json' }, body: 'x'.repeat(5000) })).status, 413, 'oversized audit body rejected');
  for (let i = 0; i < 12; i++) {
    const reply = await originalFetch(`${origin}/api/audit`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-local-client': 'audit-throttle' }, body: JSON.stringify({ url: 'http://127.0.0.1/' }) });
    assert.equal(reply.status, 400);
  }
  check((await originalFetch(`${origin}/api/audit`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-local-client': 'audit-throttle' }, body: JSON.stringify({ url: 'http://127.0.0.1/' }) })).status, 429, 'audit local rate threshold enforced');
  console.log(`Local HTTP penetration checks passed: ${assertions}; mocked mail calls: ${emails}. No production targets used.`);
} finally {
  globalThis.fetch = originalFetch;
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
