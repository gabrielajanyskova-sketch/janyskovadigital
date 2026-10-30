import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/contact.js';
import { onRequestGet } from '../functions/api/turnstile.js';

const env = { TURNSTILE_SECRET_KEY: 'test-secret', TURNSTILE_SITE_KEY: 'public-test-key', RESEND_API_KEY: 'test-mail', CONTACT_LIMITER: { limit: async () => ({ success: true }) } };
const valid = { success: true, action: 'contact', hostname: 'janyskovadigital.cz' };
function request(token, { json = true, honeypot = false } = {}) {
  const body = new FormData();
  for (const [key, value] of Object.entries({ jmeno: 'Test', email: 'test@example.com', message: '<script>test</script>' })) body.set(key, value);
  if (token !== undefined) body.set('cf-turnstile-response', token);
  if (honeypot) body.set('botcheck', 'yes');
  return new Request('https://janyskovadigital.cz/api/contact', { method: 'POST', body, headers: json ? { Accept: 'application/json' } : {} });
}

test('contact: verification gates every mail, including native cross-subdomain submissions', async t => {
  const original = globalThis.fetch;
  let calls, verify;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/siteverify')) {
      if (verify instanceof Error) throw verify;
      return verify instanceof Response ? verify : Response.json(verify);
    }
    assert.equal(url, 'https://api.resend.com/emails');
    return Response.json({ id: 'mock' });
  };
  try {
    for (const [name, token, result, expected] of [
      ['missing', undefined, valid, 400], ['empty', '', valid, 400],
      ['too long', 'x'.repeat(2049), valid, 400],
      ['invalid token', 'token', { success: false }, 400],
      ['expired or replayed', 'token', { success: false, 'error-codes': ['timeout-or-duplicate'] }, 400],
      ['wrong action', 'token', { ...valid, action: 'other' }, 400],
      ['wrong hostname', 'token', { ...valid, hostname: 'foreign.example' }, 400],
      ['hostname suffix attack', 'token', { ...valid, hostname: 'janyskovadigital.cz.foreign.example' }, 400],
      ['timeout', 'token', new DOMException('Timeout', 'TimeoutError'), 503],
      ['upstream failure', 'token', new Response('unavailable', { status: 500 }), 503],
      ['malformed response', 'token', new Response('not JSON'), 503],
      ['missing success', 'token', {}, 400],
    ]) await t.test(name, async () => {
      calls = []; verify = result;
      const response = await onRequestPost({ request: request(token), env });
      assert.equal(response.status, expected);
      assert.equal((await response.json()).success, false);
      assert(!calls.some(c => c.url.includes('resend.com')));
    });
    await t.test('unconfigured secret fails closed', async () => {
      calls = []; verify = valid;
      assert.equal((await onRequestPost({ request: request('token'), env: { CONTACT_LIMITER: env.CONTACT_LIMITER } })).status, 503);
      assert.equal(calls.length, 0);
    });
    await t.test('honeypot does not send or verify', async () => {
      calls = [];
      assert.equal((await onRequestPost({ request: request(undefined, { honeypot: true }), env })).status, 200);
      assert.equal(calls.length, 0);
    });
    for (const hostname of ['janyskovadigital.cz', 'www.janyskovadigital.cz', 'testwebu.janyskovadigital.cz']) await t.test(`valid ${hostname}`, async () => {
      calls = []; verify = { ...valid, hostname };
      const response = await onRequestPost({ request: request('valid-token', { json: hostname !== 'testwebu.janyskovadigital.cz' }), env });
      assert.equal(response.status, hostname === 'testwebu.janyskovadigital.cz' ? 303 : 200);
      assert.equal(calls.length, 2);
      assert.equal(JSON.parse(calls[0].options.body).response, 'valid-token');
      assert.equal(JSON.parse(calls[0].options.body).secret, env.TURNSTILE_SECRET_KEY);
      assert(JSON.parse(calls[1].options.body).html.includes('&lt;script&gt;'));
      if (response.status === 303) assert.equal(response.headers.get('Location'), 'https://janyskovadigital.cz/podekovani');
    });
  } finally { globalThis.fetch = original; }
});

test('public configuration exposes only site key and permits the audit origin', async () => {
  const request = new Request('https://janyskovadigital.cz/api/turnstile', { headers: { Origin: 'https://testwebu.janyskovadigital.cz' } });
  const response = onRequestGet({ request, env });
  assert.deepEqual(await response.json(), { sitekey: env.TURNSTILE_SITE_KEY });
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://testwebu.janyskovadigital.cz');
  assert.equal(onRequestGet({ request, env: {} }).status, 503);
  const configured = onRequestGet({ request, env: { TURNSTILE_SECRET_KEY: 'test-secret' } });
  assert.equal(configured.status, 200);
  assert.deepEqual(await configured.json(), { sitekey: '0x4AAAAAAFsO2XWvTMVxMmsT' });
  const foreign = onRequestGet({ request: new Request(request.url, { headers: { Origin: 'https://foreign.example' } }), env });
  assert.equal(foreign.headers.get('Access-Control-Allow-Origin'), null);
});
