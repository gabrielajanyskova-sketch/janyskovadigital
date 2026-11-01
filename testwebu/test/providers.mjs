import test from 'node:test';
import assert from 'node:assert/strict';
import { readRegistration, registrationSummary, providerSummary } from '../lib/providers.js';
import { readDomainDns, audit } from '../lib/audit.js';

const record = {
  objectClassName: 'domain', ldhName: 'EXAMPLE.CZ',
  entities: [
    { roles: ['registrant'], vcardArray: ['vcard', [['fn', {}, 'text', 'PRIVATE OWNER']]] },
    { roles: ['registrar'], handle: 'REG-DEMO', vcardArray: ['vcard', [['fn', {}, 'text', 'Demo registrar']]], entities: [{ roles: ['abuse'], email: 'private@example.cz' }] },
  ],
  events: [{ eventAction: 'registration', eventDate: '2020-06-15T12:00:00+02:00' }, { eventAction: 'last changed', eventDate: '2026-10-01T12:00:00Z' }, { eventAction: 'expiration', eventDate: '2027-01-02T00:00:00Z' }],
};
test('RDAP returns only registrar and registry expiration, never owner contacts', async () => {
  const result = await readRegistration('example.cz', async (url, options) => {
    assert.equal(url, 'https://rdap.nic.cz/domain/example.cz');
    assert.equal(options.redirect, 'error');
    return Response.json(record);
  });
  assert.equal(result.status, 'ok');
  assert.equal(result.registrar, 'Demo registrar');
  assert.equal(result.registered, '2020-06-15T10:00:00.000Z');
  assert.equal(result.changed, '2026-10-01T12:00:00.000Z');
  assert.equal(result.expires, '2027-01-02T00:00:00.000Z');
  assert(!JSON.stringify(result).includes('PRIVATE'));
  assert(!JSON.stringify(result).includes('private@'));
  assert.equal(registrationSummary({ ...record, ldhName: 'other.cz' }, 'example.cz'), null);
});
test('unknown registrars, absent dates, unsupported TLDs and unavailable RDAP remain unknown', async () => {
  assert.equal((await readRegistration('example.invalid', () => assert.fail('must not fetch'))).status, 'unsupported');
  for (const response of [Response.json({}, { status: 429 }), new Response('no json'), Response.json({ ...record, ldhName: 'other.cz' }), new Response('x'.repeat(131073), { headers: { 'content-type': 'application/json' } })]) {
    assert.equal((await readRegistration('example.cz', async () => response)).status, 'unavailable');
  }
  assert.equal((await readRegistration('example.cz', async () => { throw new Error('timeout'); })).status, 'unavailable');
  assert.deepEqual(registrationSummary({ ...record, entities: [{ roles: ['registrar'], handle: 'REG-DEMO' }], events: [] }, 'example.cz'), { registrar: 'REG-DEMO', registered: null, changed: null, expires: null });
});
test('DNS and mail are separate indications; Cloudflare does not disclose origin hosting', () => {
  const result = providerSummary('example.cz', { nameservers: ['bob.ns.cloudflare.com.', 'bob.ns.cloudflare.com.'], mailservers: ['example-cz.mail.protection.outlook.com.'] }, null, { server: 'cloudflare' });
  assert.deepEqual(result.nameservers, ['bob.ns.cloudflare.com']);
  assert.deepEqual(result.dnsProviders, ['Cloudflare']);
  assert.deepEqual(result.mailProviders, ['Microsoft 365']);
  assert.match(result.delivery[0], /skutečný hosting nemusí/);
  assert.deepEqual(providerSummary('example.cz', { nameservers: ['ns.cloudflare.com.evil.cz'], mailservers: ['not-google.com'] }, null).dnsProviders, []);
});
test('DNS summary preserves full MX hostnames and NS without changing existing counts', async () => {
  const dns = await readDomainDns('example.cz', async url => {
    const type = new URL(url).searchParams.get('type');
    return Response.json({ Status: 0, Answer: type === 'MX' ? [{ type: 15, data: '10 mx.seznam.cz.' }] : type === 'NS' ? [{ type: 2, data: 'ns.wedos.cz.' }] : [] });
  });
  assert.equal(dns.mx, 1);
  assert.deepEqual(dns.mailservers, ['mx.seznam.cz.']);
  assert.deepEqual(dns.nameservers, ['ns.wedos.cz.']);
});
test('audit includes public provider summary; unavailable optional registration never changes checks', async () => {
  const mocked = available => async (url) => {
    if (String(url).startsWith('https://rdap.nic.cz/')) return available ? Response.json(record) : new Response('', { status: 503 });
    if (String(url).startsWith('https://cloudflare-dns.com/')) return Response.json({ Status: 0, Answer: [] });
    return new Response('<html><head><title>Firma</title></head><body><h1>Firma</h1></body></html>', { headers: { 'content-type': 'text/html' } });
  };
  const a = await audit('https://example.cz/', { checkHost: false, fetchImpl: mocked(true) });
  const b = await audit('https://example.cz/', { checkHost: false, fetchImpl: mocked(false) });
  assert.equal(a.providers.registration.registrar, 'Demo registrar');
  assert.equal(b.providers.registration.status, 'unavailable');
  assert.deepEqual(a.scores, b.scores);
  assert.equal(a.incomplete, b.incomplete);
});

test('Seznam Email Profi matches customer-specific MX names without matching lookalike domains', () => {
  const summarize = host => providerSummary('example.cz', { mailservers: [host] }, null).mailProviders;
  assert.deepEqual(summarize('7e672a7af9551dff.mx2.emailprofi.seznam.cz.'), ['Seznam Email Profi']);
  assert.deepEqual(summarize('7e672a7af9551dff.mx1.emailprofi.seznam.cz.'), ['Seznam Email Profi']);
  assert.deepEqual(summarize('mx1.emailprofi.seznam.cz.evil.cz'), []);
});
test('RDAP failures have actionable reasons without exposing response bodies', async () => {
  assert.equal((await readRegistration('example.cz', async () => new Response('private', { status: 429 }))).reason, 'rate-limit');
  assert.equal((await readRegistration('example.cz', async () => { throw new Error('private details'); })).reason, 'network-error');
  assert.equal((await readRegistration('example.cz', async () => Response.json({}))).reason, 'invalid-response');
});

test('registration dates are not replaced with unrelated transfer or expiration events', () => {
  const result = registrationSummary({ ...record, events: [{ eventAction: 'registration', eventDate: 'invalid' }, { eventAction: 'transfer', eventDate: '2021-01-01T00:00:00Z' }] }, 'example.cz');
  assert.equal(result.registered, null);
  assert.equal(result.changed, null);
  assert.equal(result.expires, null);
});
