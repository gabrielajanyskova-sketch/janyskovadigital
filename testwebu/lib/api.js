import { rateLimited as checkLimit, InputError } from '../../functions/_lib/security.js';
// Společné věci pro API endpointy: odpovědi, cache výsledků, ochrana proti zneužití.

import { AuditError } from './http.js';

const CACHE_SECONDS = 3600;

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
  // Otevření adresy API přímo v prohlížeči (i z odkazu) je v pořádku — cizí stránky ale nesmí API volat skriptem
  if (request.headers.get('sec-fetch-mode') === 'navigate') return true;
  if (site && !['same-origin', 'none'].includes(site)) return false;
  return !origin || origin === new URL(request.url).origin;
}

// Volitelné omezení počtu testů (Cloudflare Rate Limiting binding AUDIT_LIMITER ve wrangler.toml)
export async function rateLimited(env, request) {
  return checkLimit(env, request, { binding: 'AUDIT_LIMITER', limit: 12, windowMs: 60000 });
}

// Výsledek pro stejnou adresu se hodinu bere z cache (šetří limit Googlu a cizí servery)
export async function cached(cacheKey, compute) {
  const cache = globalThis.caches?.default;
  const key = new Request(cacheKey);
  if (cache) {
    const hit = await cache.match(key);
    if (hit) return { data: await hit.json(), hit: true };
  }
  const data = await compute();
  if (cache) {
    await cache.put(key, new Response(JSON.stringify(data), {
      headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${CACHE_SECONDS}` },
    }));
  }
  return { data, hit: false };
}

export function handleError(e) {
  if (e instanceof AuditError || e instanceof InputError) return json({ error: e.message }, e.status);
  console.error(e);
  return json({ error: 'Při testu nastala chyba. Zkuste to prosím znovu.' }, 500);
}
