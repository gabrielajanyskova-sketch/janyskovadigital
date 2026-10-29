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
import { emailChecks } from '../lib/checks.js';
import assert from 'node:assert/strict';
const st = dns => Object.fromEntries(emailChecks(dns, 'firma.cz').map(c => [c.id, c.status]));
assert.deepEqual(st({ txt: [], dmarc: [], mx: 2 }), { spf: 'fail', dmarc: 'fail' });
assert.deepEqual(st({ txt: ['v=spf1 include:spf.seznam.cz ~all'], dmarc: ['v=DMARC1; p=none; rua=mailto:a@firma.cz'], mx: 2 }), { spf: 'pass', dmarc: 'warn' });
assert.deepEqual(st({ txt: ['v=spf1 include:spf.seznam.cz ?all', 'google-site-verification=x'], dmarc: ['v=DMARC1; p=reject'], mx: 1 }), { spf: 'warn', dmarc: 'pass' });
assert.deepEqual(st({ txt: ['v=spf1 a ~all', 'v=spf1 mx -all'], dmarc: ['v=DMARC1;p=quarantine'], mx: 1 }), { spf: 'fail', dmarc: 'pass' });
assert.deepEqual(emailChecks(null, 'firma.cz'), []);
console.log('✓ Kontrola e-mailu (SPF, DMARC)');
