// Lokální běh aplikace: servíruje public/ s hlavičkami z _headers a volá funkce z functions/api
// stejně jako Cloudflare Pages. Fiktivní domény *.test se přesměrují na lokální testovací weby
// a Google PageSpeed se nahradí uloženým výsledkem (z tohoto prostředí není dostupný).
//
//   node test/dev.mjs            → http://localhost:8788
//   spatny-web.test  = fixtures/bad (port 8790),  dobry-web.test = http://localhost:8765 (hlavní web)

import http from 'http';
import fs from 'fs';
import path from 'path';
import { badSite } from './server.mjs';
import * as auditFn from '../functions/api/audit.js';
import * as speedFn from '../functions/api/speed.js';

const root = new URL('../public/', import.meta.url).pathname;
const lighthouse = JSON.parse(fs.readFileSync(new URL('./fixtures/lighthouse.json', import.meta.url)));
const TARGETS = { 'spatny-web.test': 'http://localhost:8790', 'www.spatny-web.test': 'http://localhost:8790', 'dobry-web.test': 'http://localhost:8765' };
const PSI_DELAY = +process.env.PSI_DELAY || 3000;

const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (url.hostname === 'www.googleapis.com') {
    await new Promise(r => setTimeout(r, PSI_DELAY));
    if (process.env.PSI_FAIL) return new Response(JSON.stringify({ error: { code: 429, message: 'Quota exceeded' } }), { status: 429 });
    return new Response(JSON.stringify({ lighthouseResult: lighthouse }), { headers: { 'content-type': 'application/json' } });
  }
  if (url.hostname === 'cloudflare-dns.com') {
    // dobry-web.test má SPF i DMARC, spatny-web.test jen MX bez ochrany
    const name = url.searchParams.get('name'), type = url.searchParams.get('type');
    const good = name.endsWith('dobry-web.test');
    const answer = type === 'TXT' ? (!good ? [] : name.startsWith('_dmarc.') ? [{ type: 16, data: '"v=DMARC1; p=quarantine"' }] : [{ type: 16, data: '"v=spf1 include:spf.seznam.cz ~all"' }])
      : type === 'MX' ? [{ type: 15, data: '10 mx.seznam.cz.' }] : [{ type: 1, data: '93.184.216.34' }];
    return new Response(JSON.stringify({ Status: 0, Answer: answer }));
  }
  const target = TARGETS[url.hostname];
  if (target) return realFetch(target + url.pathname + url.search, init);
  return new Response('offline', { status: 502 });
};

const headerBlock = fs.readFileSync(path.join(root, '_headers'), 'utf8').split(/\n(?=\/)/)[0];
const securityHeaders = Object.fromEntries(headerBlock.split('\n').slice(1).filter(Boolean).map(l => l.trim().split(/:\s(.+)/).slice(0, 2)));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain', '.xml': 'application/xml' };

badSite(8790);
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:8788');
  if (url.pathname.startsWith('/api/')) {
    const body = await new Promise(r => { let d = ''; req.on('data', c => (d += c)); req.on('end', () => r(d)); });
    const request = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
    const fn = url.pathname === '/api/audit' ? auditFn : url.pathname === '/api/speed' ? speedFn : null;
    const handler = fn && (req.method === 'POST' ? fn.onRequestPost : fn.onRequestGet);
    const response = handler ? await handler({ request, env: { PAGESPEED_API_KEY: 'test' } }) : new Response('Not found', { status: 404 });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    return res.end(Buffer.from(await response.arrayBuffer()));
  }
  const file = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', ...securityHeaders });
  fs.createReadStream(file).pipe(res);
}).listen(8788, () => console.log('http://localhost:8788'));
