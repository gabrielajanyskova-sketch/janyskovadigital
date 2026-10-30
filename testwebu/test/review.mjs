import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeHtml, decode } from '../lib/html.js';
import { parseRobots, readDomainDns, audit } from '../lib/audit.js';
import { emailChecks, score } from '../lib/checks.js';
import { sameOrigin } from '../lib/api.js';
import { runPsi } from '../lib/psi.js';
import { fetchPage } from '../lib/http.js';

const mail = (dmarc, txt = ['v=spf1 include:spf.seznam.cz ~all'], mx = 1) => emailChecks({ txt, dmarc, mx }, 'firma.cz');
const dm = values => mail(values).find(c => c.id === 'dmarc');

test('informational and unavailable findings neither lower nor improve scores', () => {
  assert.deepEqual(score([{ category: 'email', weight: 3, status: 'info' }]), {});
  const checks = [{ category: 'email', weight: 3, status: 'warn' }];
  assert.deepEqual(score([...checks, { category: 'email', weight: 10, status: 'info' }]), score(checks));
});

test('DMARC: missing, invalid, duplicated and zero-percent policy are never a pass', () => {
  for (const values of [[], ['v=DMARC1'], ['v=DMARC1; p=bogus'], ['v=DMARC1; p=reject; p=none'], ['v=DMARC1; p=reject', 'v=DMARC1; p=reject'], ['v=DMARC1; p=reject; pct=101'], ['v=DMARC1; p=reject; pct=0']]) {
    assert.notEqual(dm(values).status, 'pass', JSON.stringify(values));
  }
  assert.equal(dm(['v=DMARC1; p=reject']).status, 'pass');
  assert.equal(dm(['v=DMARC1; p=quarantine; pct=50']).status, 'warn');
});
test('DMARC p=none without rua does not claim reports are sent', () => {
  const c = dm(['v=DMARC1; p=none']);
  assert.match(c.why, /Chybí rua/);
  assert.match(c.fix, /DKIM/);
});
test('absence of MX is not proof that a domain sends no mail', () => {
  const c = mail([], [], 0).find(c => c.id === 'spf');
  assert.match(c.fix, /jen tehdy/);
  assert(!c.fix.includes('stačí TXT'));
  assert.notEqual(mail([], ['v=spf1 +all'])[0].status, 'pass');
});
test('DNS failure and partial DNS failure stay unknown, not missing', async () => {
  const down = await readDomainDns('firma.cz', async () => Response.json({ Status: 2 }));
  assert.equal(down, null);
  assert.equal(emailChecks(down, 'firma.cz')[0].status, 'info');
  const partial = await readDomainDns('firma.cz', async u => Response.json({ Status: ['TXT'].includes(new URL(u).searchParams.get('type')) ? 0 : 2 }));
  assert.deepEqual(partial, { txt: [], dmarc: [], mx: null, ds: null, caa: null });
});
test('robots: training restrictions do not imply search restrictions', () => {
  const r = parseRobots('User-agent: GPTBot\nDisallow: /\nUser-agent: ClaudeBot\nDisallow: /');
  assert.deepEqual(r.aiBlocked, []);
  assert.deepEqual(r.trainingBlocked, ['GPTBot', 'ClaudeBot']);
  assert(parseRobots('User-agent: Claude-SearchBot\nDisallow: /').aiBlocked.includes('Claude-SearchBot'));
});
test('hostile HTML: invalid entities and canonical cannot crash parsing; comments are ignored', () => {
  assert.equal(decode('&#999999999999999999; &#xD800;'), '\ufffd \ufffd');
  const p = analyzeHtml('<head><link rel="canonical" href="http://["></head><body><!--<h1>Fake</h1>--><h1>Real &#x110000;</h1><p>GDPR</p></body>', 'https://firma.cz/');
  assert.equal(p.canonical, null);
  assert.equal(p.headings.length, 1);
  assert.equal(p.privacyLink, false);
  assert.equal(analyzeHtml('<a href="/ochrana-udaju">Soukromí</a>', 'https://firma.cz/').privacyLink, true);
});
test('deep @graph does not repeatedly traverse the same graph', () => {
  let data = { '@type': 'Organization' };
  for (let i = 0; i < 24; i++) data = { '@graph': [data] };
  const p = analyzeHtml(`<script type="application/ld+json">${JSON.stringify(data)}</script>`, 'https://firma.cz/');
  assert.deepEqual(p.jsonLd[0], { valid: true, types: ['Organization'] });
});
test('cross-site navigation cannot bypass origin checks', () => {
  assert.equal(sameOrigin(new Request('https://test.cz/api/speed', { headers: { 'sec-fetch-mode': 'navigate', 'sec-fetch-site': 'cross-site' } })), false);
  assert.equal(sameOrigin(new Request('https://test.cz/api/speed', { headers: { 'sec-fetch-site': 'same-origin', origin: 'https://test.cz' } })), true);
});
test('oversized page is rejected, not silently scored from partial HTML', async () => {
  const res = await fetchPage('https://firma.cz/', { checkHost: false, fetchImpl: async () => new Response('x'.repeat(3 * 1024 * 1024 + 1)) });
  assert.equal(res.error, 'size');
  assert.equal(res.ok, false);
});
test('Lighthouse runtime errors or missing performance are not a successful speed result', async () => {
  for (const lighthouseResult of [{ runtimeError: { code: 'NO_FCP' } }, { categories: { performance: { score: null } } }]) {
    const result = await runPsi('https://firma.cz/', 'mobile', { fetchImpl: async () => Response.json({ lighthouseResult }) });
    assert(result.error);
  }
});
test('failed pages are not diagnosed with missing titles, descriptions and headings', async () => {
  const main = '<html lang="cs"><head><title>Firma</title></head><body><h1>Firma</h1><a href="/sluzby">Služby</a></body></html>';
  const report = await audit('https://firma.cz/', { checkHost: false, fetchImpl: async (u, opts) => {
    const url = new URL(u);
    if (url.hostname === 'cloudflare-dns.com') return Response.json({ Status: 2 });
    if (url.pathname === '/sluzby') throw new Error('timeout');
    if (url.pathname === '/' && url.hostname === 'firma.cz') return new Response(main, { headers: { 'content-type': 'text/html' } });
    if (url.pathname === '/robots.txt') return new Response('Denied', { status: 403 });
    return new Response('missing', { status: 404 });
  } });
  const sub = report.checks.find(c => c.id === 'subpages');
  assert.equal(sub.status, 'info');
  assert(!sub.detail.includes('chybí popis'));
  assert(!sub.detail.includes('H1'));
  assert.equal(report.checks.find(c => c.id === 'ai-bots').status, 'info');
  assert(report.checks.find(c => c.id === 'links-unverified'));
  assert(!report.checks.some(c => c.id === 'broken-links' && c.status === 'pass'));
});

test('privacy link detection uses visible text, nested labels and legal-page fragments', () => {
  for (const markup of [
    '<a href="/pravni-informace#udaje">Ochrana osobních údajů</a>',
    '<a href="/legal#personal"><span>Ochrana</span>&nbsp;osobních <strong>údajů</strong></a>',
    '<a href="/dokumenty/123">Zásady zpracování osobních údajů</a>',
    '<a href="/legal#data" aria-label="Ochrana osobních údajů"><img src="icon.png" alt=""></a>',
    '<a href="/legal#data" title="Ochrana soukromí">Více</a>',
    '<a href="#gdpr">Právní informace</a>',
    '<a href="#osobni-udaje">Podrobnosti</a>',
    '<a href="/ochrana-udaju">Více</a>',
    '<a href="/z%C3%A1sady-ochrany-osobn%C3%ADch-%C3%BAdaj%C5%AF">Více</a>',
    '<a href="https://www.firma.cz/legal#data">Privacy policy</a>',
  ]) assert.equal(analyzeHtml(markup, 'https://firma.cz/').privacyLink, true, markup);
});
test('privacy link detection does not pass plain text, scripts, empty anchors or non-web links', () => {
  for (const markup of [
    '<p>Ochrana osobních údajů a GDPR</p>',
    '<!-- <a href="/gdpr">Ochrana osobních údajů</a> -->',
    '<script>const s = \'<a href="/gdpr">Ochrana osobních údajů</a>\';</script>',
    '<a href="#">Ochrana osobních údajů</a>',
    '<a href="">Ochrana osobních údajů</a>',
    '<a href="javascript:openPrivacy()">Ochrana osobních údajů</a>',
    '<a href="mailto:gdpr@firma.cz">Ochrana osobních údajů</a>',
    '<a href="https://gdpr.example.com/kontakt">Kontakt</a>',
  ]) assert.equal(analyzeHtml(markup, 'https://firma.cz/').privacyLink, false, markup);
});
