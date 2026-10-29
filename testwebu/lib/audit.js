// Sestaví audit webu (bez měření rychlosti — to běží zvlášť přes /api/speed, protože trvá déle).

import { normalizeUrl, assertPublicHost, fetchPage, AuditError } from './http.js';
import { analyzeHtml } from './html.js';
import { siteChecks, score, CATEGORIES } from './checks.js';

const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-Web', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended'];
const SAMPLE_PAGES = 5;

export async function audit(input, { fetchImpl = fetch, checkHost = true } = {}) {
  const url = checkHost ? normalizeUrl(input) : new URL(input);
  if (checkHost) await assertPublicHost(url.hostname, fetchImpl);
  const opts = { fetchImpl, checkHost };

  const main = await fetchPage(url.href, opts);
  if (!main.status) {
    const msg = { timeout: 'Web neodpověděl do 12 sekund.', redirects: 'Web se zacyklil v přesměrováních.', blocked: 'Web přesměrovává na adresu, kterou nelze otestovat.' }[main.error] || 'Web se nepodařilo načíst. Zkontrolujte adresu.';
    throw new AuditError(msg, 422);
  }
  if (main.status >= 400) throw new AuditError(`Web odpověděl chybou ${main.status}${main.status === 403 ? ' (pravděpodobně blokuje automatické kontroly)' : ''}.`, 422);
  if (!/html/i.test(main.contentType)) throw new AuditError('Na adrese není webová stránka (HTML).', 422);

  const final = new URL(main.url);
  const origin = final.origin;
  const page = analyzeHtml(main.body, main.url);

  const otherHost = final.hostname.startsWith('www.') ? final.hostname.slice(4) : 'www.' + final.hostname;
  const probe = `${origin}/tato-stranka-neexistuje-${Math.random().toString(36).slice(2, 8)}`;
  const [httpVer, wwwVer, robotsRes, llmsRes, notFoundRes] = await Promise.all([
    final.protocol === 'https:' ? fetchPage(`http://${final.host}${final.pathname}`, opts) : null,
    fetchPage(`${final.protocol}//${otherHost}${final.pathname}`, opts).catch(() => null),
    fetchPage(`${origin}/robots.txt`, opts),
    fetchPage(`${origin}/llms.txt`, opts),
    fetchPage(probe, opts),
  ]);

  const robots = parseRobots(robotsRes?.status === 200 && /text\/plain/i.test(robotsRes.contentType) ? robotsRes.body : null);
  const sitemap = await readSitemap(robots.sitemap || `${origin}/sitemap.xml`, opts, final.hostname);

  // Další stránky: ze sitemapy, jinak z odkazů na úvodní stránce
  const candidates = (sitemap.list.length ? sitemap.list : page.internalLinks)
    .filter(u => { try { const x = new URL(u); return x.hostname === final.hostname && x.href.replace(/\/$/, '') !== main.url.replace(/\/$/, '') && !/\.(pdf|jpe?g|png|webp|gif|svg|zip|docx?|xlsx?)$/i.test(x.pathname); } catch { return false; } })
    .slice(0, SAMPLE_PAGES);
  const pages = (await Promise.all(candidates.map(u => fetchPage(u, opts)))).map((res, i) => {
    if (!res.status || !/html/i.test(res.contentType || '')) return { url: candidates[i], status: res.status || 0 };
    const a = analyzeHtml(res.body, res.url);
    return { url: res.url, status: res.status, title: a.title, description: a.description, h1: a.headings.filter(h => h.level === 1).length };
  });

  const headers = Object.fromEntries([...main.headers.entries()].map(([k, v]) => [k.toLowerCase(), v]));
  const report = {
    url: url.href,
    finalUrl: main.url,
    chain: main.chain,
    ttfb: main.ms,
    headers,
    page,
    platforms: page.platforms,
    httpRedirect: httpVer ? {
      toHttps: httpVer.chain.length > 0 && /^https:/.test(httpVer.url),
      permanent: [301, 308].includes(httpVer.chain[0]?.status),
    } : null,
    wwwCheck: wwwVer && wwwVer.status ? {
      other: `${final.protocol}//${otherHost}`,
      consistent: new URL(wwwVer.url).hostname === final.hostname,
    } : null,
    robots,
    sitemap: { url: sitemap.url, urls: sitemap.count },
    llms: llmsRes?.status === 200 && /text\/(plain|markdown)/i.test(llmsRes.contentType) && llmsRes.body.trim().startsWith('#'),
    notFound: { url: probe, status: notFoundRes?.status || 0 },
    pages,
  };

  const checks = siteChecks(report);
  return {
    url: report.url,
    finalUrl: report.finalUrl,
    platforms: report.platforms,
    checkedAt: new Date().toISOString(),
    categories: CATEGORIES,
    scores: score(checks),
    checks,
    pages: pages.map(p => ({ url: p.url, status: p.status })),
  };
}

export function parseRobots(text) {
  if (text == null) return { exists: false, blocksAll: false, aiBlocked: [], sitemap: null };
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  let sitemap = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const [, key, value] = m;
    const k = key.toLowerCase();
    if (k === 'sitemap') { sitemap ||= value.trim(); continue; }
    if (k === 'user-agent') {
      if (!lastWasAgent) { current = { agents: [], disallowAll: false, allowAll: false }; groups.push(current); }
      current.agents.push(value.trim().toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (k === 'disallow' && value.trim() === '/') current.disallowAll = true;
    if (k === 'allow' && value.trim() === '/') current.allowAll = true;
  }
  const blocked = agent => {
    const g = groups.find(x => x.agents.includes(agent.toLowerCase())) || groups.find(x => x.agents.includes('*'));
    return !!g && g.disallowAll && !g.allowAll;
  };
  return { exists: true, blocksAll: blocked('Googlebot') && blocked('*'), aiBlocked: AI_BOTS.filter(blocked), sitemap };
}

async function readSitemap(url, opts, host, depth = 0) {
  const res = await fetchPage(url, opts).catch(() => null);
  if (!res || res.status !== 200 || !/<(urlset|sitemapindex)\b/i.test(res.body || '')) return { url: null, count: 0, list: [] };
  const locs = [...res.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1].replace(/&amp;/g, '&'));
  if (/<sitemapindex\b/i.test(res.body) && depth === 0 && locs.length) {
    const child = await readSitemap(locs[0], opts, host, 1);
    return { url: res.url, count: child.count, list: child.list };
  }
  return { url: res.url, count: locs.length, list: locs };
}
