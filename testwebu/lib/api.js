import { rateLimited as checkLimit, InputError } from '../../functions/_lib/security.js';
// Společné věci pro API endpointy: odpovědi, cache výsledků, ochrana proti zneužití.

import { AuditError } from './http.js';

const CACHE_SECONDS = 3600;
const CACHE_VERSION = 'v3';
const MAX_IN_FLIGHT = 8;
const MAX_AUDITS_IN_FLIGHT = 2;
const inFlight = new Map();
let auditsInFlight = 0;

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...extra,
    },
  });
}

// Volat API smí jen stránka aplikace (ne cizí weby přes prohlížeče návštěvníků)
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  // Ani navigace z cizího webu nemá spouštět placené měření. Nejde o autentizaci API.
  if (site && !['same-origin', 'none'].includes(site)) return false;
  return !origin || origin === new URL(request.url).origin;
}

// Volitelné omezení počtu testů (Cloudflare Rate Limiting binding AUDIT_LIMITER ve wrangler.toml)
export async function rateLimited(env, request) {
  return checkLimit(env, request, { binding: 'AUDIT_LIMITER', limit: 12, windowMs: 60000 });
}

// Výsledek pro stejnou adresu se hodinu bere z cache (šetří limit Googlu a cizí servery)
export async function cached(cacheKey, compute, { refresh = false } = {}) {
  const cache = globalThis.caches?.default;
  const versioned = new URL(cacheKey);
  versioned.pathname = `/__cache/${CACHE_VERSION}${versioned.pathname}`;
  const key = new Request(versioned);
  if (inFlight.has(key.url)) return inFlight.get(key.url);
  if (cache && !refresh) {
    try {
      const hit = await cache.match(key);
      if (hit) return { data: await hit.json(), hit: true };
    } catch { console.warn('Cache výsledků není dostupná.'); }
  }
  // Souběžné dotazy stejného izolátu sdílejí jedno měření. Nejde o globální limit.
  if (inFlight.has(key.url)) return inFlight.get(key.url);
  const isAudit = versioned.pathname.endsWith('/audit');
  if (inFlight.size >= MAX_IN_FLIGHT || (isAudit && auditsInFlight >= MAX_AUDITS_IN_FLIGHT)) throw new AuditError('Test je teď vytížený. Zkuste to prosím za chvíli.', 503);
  if (isAudit) auditsInFlight++;
  const task = Promise.resolve().then(async () => {
    const data = await compute();
    if (cache) {
      try {
        await cache.put(key, new Response(JSON.stringify(data), {
          headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${CACHE_SECONDS}` },
        }));
      } catch { console.warn('Výsledek se nepodařilo uložit do cache.'); }
    }
    return { data, hit: false };
  });
  inFlight.set(key.url, task);
  try { return await task; }
  finally { inFlight.delete(key.url); if (isAudit) auditsInFlight--; }
}

export function handleError(e) {
  if (e instanceof AuditError || e instanceof InputError) return json({ error: e.message }, e.status);
  console.error(e);
  return json({ error: 'Při testu nastala chyba. Zkuste to prosím znovu.' }, 500);
}
