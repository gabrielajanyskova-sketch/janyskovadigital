// Automatická kontrola hotového webu. Spouští se `npm run check` (a v GitHub Actions).
// Najde rozbité odkazy, chybějící meta údaje, neplatná strukturovaná data apod.
// Při jakékoli chybě skončí s nenulovým kódem.

import { readFile, readdir, access } from 'fs/promises';
import path from 'path';

const SKIP_DIRS = new Set(['node_modules', 'src', 'admin', '.git', 'functions']);
const errors = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const exists = p => access(p).then(() => true, () => false);

// Převod URL na soubor podle pravidel Cloudflare Pages (čisté URL bez .html)
async function resolve(urlPath) {
  const p = decodeURIComponent(urlPath).replace(/^\//, '');
  const candidates = p === '' ? ['index.html']
    : p.endsWith('/') ? [p + 'index.html']
    : [p, p + '.html', p + '/index.html'];
  for (const c of candidates) if (await exists(c)) return c;
  return null;
}

const redirects = (await readFile('_redirects', 'utf8')).split('\n')
  .map(l => l.trim().split(/\s+/)).filter(l => l[0] && !l[0].startsWith('#')).map(l => l[0]);

const files = (await walk('.')).filter(f => f !== 'cookies.html');
const ids = new Map();
const html = new Map();
for (const f of files) {
  const s = await readFile(f, 'utf8');
  html.set(f, s);
  ids.set(f, new Set([...s.matchAll(/\sid="([^"]+)"/g)].map(m => m[1])));
}

for (const [f, s] of html) {
  const head = s.split('</head>')[0];
  const body = s.split('</head>')[1] || '';
  const noindex = /name="robots" content="[^"]*noindex/.test(head);

  if (/\{\{|@include/.test(s)) err(f, 'nevyplněná proměnná nebo @include');
  if (/fonts\.googleapis|fonts\.gstatic/.test(s)) err(f, 'načítá Google Fonts (GDPR)');
  if (!/<title>[^<]+<\/title>/.test(head)) err(f, 'chybí <title>');
  if (!/name="description" content="[^"]+"/.test(head)) err(f, 'chybí meta description');
  if (!noindex && !/rel="canonical"/.test(head)) err(f, 'chybí canonical');
  const h1 = (body.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) err(f, `${h1}× <h1> (má být 1)`);
  if (!body.includes('IČO 19616295')) err(f, 'v patičce chybí IČO');

  for (const [, json] of head.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
    try { JSON.parse(json); } catch (e) { err(f, `neplatné JSON-LD: ${e.message}`); }
  }

  for (const [, href] of body.matchAll(/\shref="([^"]+)"/g)) {
    if (/^(https?:|mailto:|tel:|javascript:)/.test(href)) continue;
    const [p, hash] = href.split('#');
    let target = f;
    if (p) {
      if (redirects.includes(p.replace(/\/$/, '')) || redirects.includes(p)) continue;
      target = await resolve(p.startsWith('/') ? p : path.join(path.dirname('/' + f), p));
      if (!target) { err(f, `rozbitý odkaz ${href}`); continue; }
    }
    if (hash && !ids.get(target)?.has(hash)) err(f, `odkaz ${href} míří na neexistující kotvu`);
  }
}

// Sitemap: všechny URL existují a nejsou noindex
const sitemap = await readFile('sitemap.xml', 'utf8');
for (const [, loc] of sitemap.matchAll(/<loc>https:\/\/janyskovadigital\.cz(\/[^<]*)<\/loc>/g)) {
  const file = await resolve(loc);
  if (!file) err('sitemap.xml', `URL ${loc} neexistuje`);
  else if (/name="robots" content="[^"]*noindex/.test(html.get(file) || '')) err('sitemap.xml', `URL ${loc} je noindex`);
}

if (errors.length) {
  console.error(`✗ ${errors.length} problémů:\n  ` + errors.join('\n  '));
  process.exit(1);
}
console.log(`✓ Kontrola prošla (${files.length} stránek)`);
