// GET /api/speed?url=…&strategy=mobile|desktop  →  měření Google PageSpeed Insights (15–40 s)

import { runPsi } from '../../lib/psi.js';
import { normalizeUrl } from '../../lib/http.js';
import { speedChecks, a11yChecks } from '../../lib/checks.js';
import { json, sameOrigin, rateLimited, cached, handleError } from '../../lib/api.js';

export async function onRequestGet({ request, env }) {
  if (!sameOrigin(request)) return json({ error: 'Nepovolený požadavek.' }, 403);
  if (await rateLimited(env, request)) return json({ error: 'Příliš mnoho testů za krátkou dobu. Zkuste to za minutu.' }, 429);
  try {
    const params = new URL(request.url).searchParams;
    const strategy = params.get('strategy') === 'desktop' ? 'desktop' : 'mobile';
    const url = normalizeUrl(params.get('url'));
    const origin = new URL(request.url).origin;
    const { data, hit } = await cached(`${origin}/__cache/speed?s=${strategy}&u=${encodeURIComponent(url.href)}`, async () => {
      const psi = await runPsi(url.href, strategy, { apiKey: env.PAGESPEED_API_KEY, fetchImpl: fetch });
      if (psi.error) throw Object.assign(new Error(psi.error), { psiError: psi.error, detail: psi.detail });
      return {
        strategy,
        scores: psi.scores,
        checks: [...speedChecks(strategy, psi), ...(strategy === 'mobile' ? a11yChecks(psi) : [])],
      };
    });
    return json(data, 200, { 'x-cache': hit ? 'HIT' : 'MISS' });
  } catch (e) {
    // 424, ne 502: odpovědi 502/504 Cloudflare nahrazuje vlastní chybovou stránkou a důvod by se ztratil
    if (e.psiError) return json({ error: e.psiError, detail: e.detail }, 424);
    return handleError(e);
  }
}
