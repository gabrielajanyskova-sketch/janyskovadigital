// POST /api/audit  { "url": "https://example.cz" }  →  technický, SEO, AI, bezpečnostní a GDPR audit

import { audit } from '../../lib/audit.js';
import { normalizeUrl } from '../../lib/http.js';
import { json, sameOrigin, rateLimited, cached, handleError } from '../../lib/api.js';

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: 'Nepovolený požadavek.' }, 403);
  if (await rateLimited(env, request)) return json({ error: 'Příliš mnoho testů za krátkou dobu. Zkuste to za minutu.' }, 429);
  try {
    const body = await request.json().catch(() => ({}));
    const url = normalizeUrl(body.url);
    const origin = new URL(request.url).origin;
    const { data, hit } = await cached(`${origin}/__cache/audit?u=${encodeURIComponent(url.href)}`, () => audit(url.href));
    return json(data, 200, { 'x-cache': hit ? 'HIT' : 'MISS' });
  } catch (e) {
    return handleError(e);
  }
}
