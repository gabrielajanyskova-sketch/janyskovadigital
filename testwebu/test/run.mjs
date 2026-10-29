// node test/run.mjs [url] — spustí audit proti lokálnímu serveru a vypíše výsledek
import { audit } from '../lib/audit.js';
import { badSite } from './server.mjs';

const target = process.argv[2];
let srv;
if (!target) srv = badSite(8791);
try {
  const r = await audit(target || 'http://localhost:8791/', { checkHost: false });
  console.log('URL:', r.finalUrl, '| platformy:', r.platforms.join(', ') || '—');
  console.log('Skóre:', JSON.stringify(r.scores));
  const icon = { pass: '✅', warn: '⚠️ ', fail: '❌', info: 'ℹ️ ' };
  for (const c of r.checks) console.log(`${icon[c.status]} [${c.category}] ${c.title} — ${c.detail}`);
} finally {
  srv?.close();
}

// Kontrola SPF a DMARC na připravených záznamech DNS
import { emailChecks, domainChecks } from '../lib/checks.js';
import { registrableDomain } from '../lib/audit.js';
import assert from 'node:assert/strict';
const st = dns => Object.fromEntries(emailChecks(dns, 'firma.cz').map(c => [c.id, c.status]));
assert.deepEqual(st({ txt: [], dmarc: [], mx: 2 }), { spf: 'fail', dmarc: 'fail' });
assert.deepEqual(st({ txt: ['v=spf1 include:spf.seznam.cz ~all'], dmarc: ['v=DMARC1; p=none; rua=mailto:a@firma.cz'], mx: 2 }), { spf: 'pass', dmarc: 'warn' });
assert.deepEqual(st({ txt: ['v=spf1 include:spf.seznam.cz ?all', 'google-site-verification=x'], dmarc: ['v=DMARC1; p=reject'], mx: 1 }), { spf: 'warn', dmarc: 'pass' });
assert.deepEqual(st({ txt: ['v=spf1 a ~all', 'v=spf1 mx -all'], dmarc: ['v=DMARC1;p=quarantine'], mx: 1 }), { spf: 'fail', dmarc: 'pass' });
assert.deepEqual(emailChecks(null, 'firma.cz'), []);
const ds = (dns, txt) => Object.fromEntries(domainChecks(dns, 'firma.cz', txt).map(c => [c.id, c.status]));
assert.deepEqual(ds({ ds: 1, caa: 0 }, true), { dnssec: 'pass', caa: 'info', 'security-txt': 'pass' });
assert.deepEqual(ds({ ds: 0, caa: 2 }, false), { dnssec: 'warn', caa: 'pass', 'security-txt': 'warn' });
assert.deepEqual(ds(null, false), { 'security-txt': 'warn' });
assert.equal(registrableDomain('www.shop.firma.cz'), 'firma.cz');
assert.equal(registrableDomain('testwebu.janyskovadigital.cz'), 'janyskovadigital.cz');
assert.equal(registrableDomain('www.firma.co.uk'), 'firma.co.uk');
assert.equal(registrableDomain('localhost'), null);
console.log('✓ Kontrola e-mailu a domény (SPF, DMARC, DNSSEC, CAA, security.txt)');

// E-mail schovaný Cloudflarem není nefunkční odkaz a počítá se jako kontakt
import { analyzeHtml } from '../lib/html.js';
const cf = analyzeHtml('<html><body><a href="/cdn-cgi/l/email-protection#a1b2">[email&#160;protected]</a><a href="/kontakt">Kontakt</a></body></html>', 'https://firma.cz/');
assert.deepEqual(cf.internalLinks, ['https://firma.cz/kontakt']);
assert.equal(cf.email, true);
console.log('✓ Ochrana e-mailu Cloudflare (bez falešného nefunkčního odkazu)');
