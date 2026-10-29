// Google PageSpeed Insights (Lighthouse na serverech Googlu + data skutečných návštěvníků z Chrome).

const ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];

// Jen části odpovědi, které aplikace používá (partial response). Vynechá snímek celé stránky,
// překlady a další velké části, aby zpracování nepřekročilo limit 10 ms procesoru na bezplatném
// tarifu Cloudflaru. Jen pole nejvyšší úrovně: podrobnější výběr (audits/*/…) Google odmítá
// jako „invalid argument“.
const FIELDS = 'lighthouseResult(categories,audits,finalUrl),loadingExperience,originLoadingExperience';

export async function runPsi(url, strategy, { apiKey, fetchImpl, fields = FIELDS }) {
  const params = new URLSearchParams({ url, strategy, locale: 'cs' });
  CATEGORIES.forEach(c => params.append('category', c));
  if (apiKey) params.set('key', apiKey);
  if (fields) params.set('fields', fields);
  let res;
  try {
    res = await fetchImpl(`${ENDPOINT}?${params}`, { signal: AbortSignal.timeout(90000) });
  } catch (e) {
    return { error: e.name === 'TimeoutError' ? 'Google měření nestihl dokončit včas.' : 'Měření Googlu se nepodařilo spustit.' };
  }
  const data = await res.json().catch(() => null);
  // Pojistka: kdyby Google výběr polí odmítl (400), zkusit to jednou bez něj
  if (res.status === 400 && fields) {
    console.warn('PSI odmítl fields:', data.error.message);
    return runPsi(url, strategy, { apiKey, fetchImpl, fields: null });
  }
  if (!res.ok || !data?.lighthouseResult) {
    const reason = data?.error?.message || '';
    // Technický důvod od Googlu (bez klíče) — pro diagnostiku, stránka aplikace ho neukazuje
    const detail = `Google ${res.status}: ${reason.replace(/key=[^&\s]+/g, 'key=…').slice(0, 300)}`;
    console.warn('PSI chyba', detail);
    if (res.status === 429) return { error: 'Měření Googlu je teď přetížené, zkuste to za chvíli.', detail };
    if (res.status === 400 && /API key|api_key|API_KEY/i.test(reason)) return { error: 'Měření Googlu odmítlo klíč aplikace.', detail };
    if (res.status === 403) return { error: 'Google měření nepovolil (klíč nebo API není aktivní).', detail };
    if (/FAILED_DOCUMENT_REQUEST|ERRORED_DOCUMENT_REQUEST|NO_FCP/.test(reason)) return { error: 'Google se na web nedostal nebo se stránka nevykreslila.', detail };
    return { error: 'Měření Googlu se nepodařilo.', detail };
  }
  return summarizePsi(data);
}

const FIELD = {
  LARGEST_CONTENTFUL_PAINT_MS: 'lcp',
  INTERACTION_TO_NEXT_PAINT: 'inp',
  CUMULATIVE_LAYOUT_SHIFT_SCORE: 'cls',
};

export function summarizePsi(data) {
  const lh = data.lighthouseResult;
  const a = lh.audits || {};
  const score = c => (lh.categories?.[c]?.score == null ? null : Math.round(lh.categories[c].score * 100));
  const metric = id => a[id] ? { value: a[id].numericValue, display: a[id].displayValue, score: a[id].score } : null;

  // Data skutečných návštěvníků (Chrome UX Report) — jen u webů s dostatečnou návštěvností
  const exp = data.loadingExperience?.metrics ? data.loadingExperience
    : data.originLoadingExperience?.metrics ? data.originLoadingExperience : null;
  let field = null;
  if (exp) {
    field = { scope: exp === data.loadingExperience ? 'page' : 'origin', overall: exp.overall_category || null };
    for (const [key, id] of Object.entries(FIELD)) {
      const m = exp.metrics[key];
      if (m) field[id] = { p75: m.percentile, category: m.category };
    }
  }

  // Největší příležitosti ke zrychlení
  // (starší audity mají details.overallSavingsMs, novější „insights“ metricSavings)
  const savings = x => Math.max(x.details?.overallSavingsMs || 0, x.metricSavings?.LCP || 0, x.metricSavings?.FCP || 0);
  const seen = new Set();
  // Novější Lighthouse má „insights“ a starší „opportunities“ s podobným obsahem: bereme jen jednu sadu
  const entries = Object.entries(a);
  const insights = entries.filter(([id]) => id.endsWith('-insight') && id !== 'lcp-breakdown-insight');
  const pool = (insights.length ? insights : entries.filter(([, x]) => x.details?.type === 'opportunity')).map(([, x]) => x);
  const opportunities = pool
    .filter(x => x.score !== null && x.score < 0.9 && savings(x) >= 100)
    .sort((x, y) => savings(y) - savings(x))
    .filter(x => !seen.has(x.title) && seen.add(x.title))
    .slice(0, 5)
    .map(x => ({ title: x.title, savingsMs: Math.round(savings(x)) }));

  // Neúspěšné kontroly přístupnosti a SEO (pro detail)
  const failed = cat => (lh.categories?.[cat]?.auditRefs || [])
    .filter(r => r.weight > 0 && a[r.id] && a[r.id].score !== null && a[r.id].score < 0.9)
    .map(r => a[r.id].title)
    .slice(0, 8);

  return {
    scores: { performance: score('performance'), accessibility: score('accessibility'), bestPractices: score('best-practices'), seo: score('seo') },
    metrics: {
      fcp: metric('first-contentful-paint'), lcp: metric('largest-contentful-paint'),
      tbt: metric('total-blocking-time'), cls: metric('cumulative-layout-shift'), si: metric('speed-index'),
    },
    field,
    opportunities,
    failedAccessibility: failed('accessibility'),
    failedSeo: failed('seo'),
    finalUrl: lh.finalDisplayedUrl || lh.finalUrl || null,
  };
}
