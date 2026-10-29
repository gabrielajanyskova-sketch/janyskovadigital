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
