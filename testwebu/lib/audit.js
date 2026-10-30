// Sestaví audit webu (bez měření rychlosti — to běží zvlášť přes /api/speed, protože trvá déle).

import { normalizeUrl, assertPublicHost, fetchPage, AuditError } from './http.js';
import { analyzeHtml } from './html.js';
import { siteChecks, emailChecks, domainChecks, score, CATEGORIES } from './checks.js';

const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-Web', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended'];
const SEARCH_BOTS = ['Googlebot', 'SeznamBot', 'Bingbot'];
const SAMPLE_PAGES = 5;
const MAX_LINKS = 15;
// Bezplatný tarif Workers dovoluje 50 odchozích požadavků na jedno volání; necháme rezervu
const SUBREQUEST_BUDGET = 45;

export async function audit(input, { fetchImpl = fetch, checkHost = true } = {}) {
  const url = checkHost ? normalizeUrl(input) : new URL(input);
  let used = 0;
  const budgeted = (u, o) => (++used > SUBREQUEST_BUDGET ? Promise.reject(new Error('subrequest budget')) : fetchImpl(u, o));
  const remaining = () => SUBREQUEST_BUDGET - used;
  if (checkHost) await assertPublicHost(url.hostname, budgeted);
  const opts = { fetchImpl: budgeted, checkHost, checkedHosts: new Set(checkHost ? [url.hostname] : []) };

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
  const domain = registrableDomain(final.hostname);
  const [httpVer, wwwVer, robotsRes, llmsRes, notFoundRes, securityTxt, dns] = await Promise.all([
    final.protocol === 'https:' ? fetchPage(`http://${final.host}${final.pathname}`, opts) : null,
    fetchPage(`${final.protocol}//${otherHost}${final.pathname}`, opts).catch(() => null),
    fetchPage(`${origin}/robots.txt`, opts),
    fetchPage(`${origin}/llms.txt`, opts),
    fetchPage(probe, opts),
    fetchPage(`${origin}/.well-known/security.txt`, opts),
    domain ? readDomainDns(domain, budgeted) : null,
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

  // Nefunkční odkazy z úvodní stránky (jen interní; cizí weby automatické kontroly často blokují)
  const known = new Map(pages.map(p => [p.url.replace(/\/$/, ''), p.status]));
  const links = page.internalLinks
    .filter(u => { try { return new URL(u).hostname === final.hostname && !/\.(pdf|jpe?g|png|webp|gif|svg|zip)$/i.test(new URL(u).pathname); } catch { return false; } })
    .filter(u => u.replace(/\/$/, '') !== main.url.replace(/\/$/, ''))
    .slice(0, Math.max(0, Math.min(MAX_LINKS, remaining() - 2)));
  const linkResults = await Promise.all(links.map(async u => {
    if (known.has(u.replace(/\/$/, ''))) return { url: u, status: known.get(u.replace(/\/$/, '')) };
    let res = await fetchPage(u, { ...opts, method: 'HEAD' });
    if ([403, 405, 501].includes(res.status)) res = await fetchPage(u, opts);   // server nepodporuje HEAD
    return { url: u, status: res.status || 0 };
  }));
  const brokenLinks = linkResults.filter(l => l.status >= 400);

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
    securityTxt: securityTxt?.status === 200 && /text\/plain/i.test(securityTxt.contentType) && /^contact:/im.test(securityTxt.body),
    llms: llmsRes?.status === 200 && /text\/(plain|markdown)/i.test(llmsRes.contentType) && llmsRes.body.trim().startsWith('#'),
    notFound: { url: probe, status: notFoundRes?.status || 0 },
    pages,
    links: { checked: linkResults.filter(l => l.status).length, broken: brokenLinks },
  };

  const checks = [...siteChecks(report), ...domainChecks(dns, domain, report.securityTxt), ...emailChecks(dns, domain)];
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
  if (text == null) return { exists: false, blocksAll: false, aiBlocked: [], searchBlocked: [], sitemap: null };
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
    const specific = groups.filter(x => x.agents.includes(agent.toLowerCase()));
    const selected = specific.length ? specific : groups.filter(x => x.agents.includes('*'));
    return selected.some(g => g.disallowAll) && !selected.some(g => g.allowAll);
  };
  return {
    exists: true, blocksAll: blocked('Googlebot') && blocked('*'),
    aiBlocked: AI_BOTS.filter(blocked), searchBlocked: SEARCH_BOTS.filter(blocked), sitemap,
  };
}

async function readSitemap(url, opts, host, depth = 0) {
  try { if (new URL(url).hostname !== host) return { url: null, count: 0, list: [] }; }
  catch { return { url: null, count: 0, list: [] }; }
  const res = await fetchPage(url, opts).catch(() => null);
  if (!res || res.status !== 200 || !/<(urlset|sitemapindex)\b/i.test(res.body || '')) return { url: null, count: 0, list: [] };
  const locs = [...res.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1].replace(/&amp;/g, '&'));
  if (/<sitemapindex\b/i.test(res.body) && depth === 0 && locs.length) {
    const child = await readSitemap(locs[0], opts, host, 1);
    return { url: res.url, count: child.count, list: child.list };
  }
  return { url: res.url, count: locs.length, list: locs };
}

// Hlavní doména webu (www.shop.firma.cz → firma.cz, firma.co.uk zůstane celá); null pro localhost a IP
export function registrableDomain(host) {
  if (!host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':')) return null;
  const parts = host.split('.');
  const n = /^(co|com|org|net|gov|edu|ac)$/.test(parts.at(-2)) && parts.at(-1).length === 2 ? 3 : 2;
  return parts.slice(-n).join('.');
}

// Záznamy domény přes DNS-over-HTTPS: SPF (TXT), DMARC (TXT _dmarc), MX, DNSSEC (DS) a CAA; null, když DNS neodpoví
export async function readDomainDns(domain, fetchImpl) {
  const lookup = (name, type) => fetchImpl(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, {
    headers: { accept: 'application/dns-json' },
    signal: AbortSignal.timeout(5000),
  }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  const [txt, dmarc, mx, ds, caa] = await Promise.all([lookup(domain, 'TXT'), lookup(`_dmarc.${domain}`, 'TXT'), lookup(domain, 'MX'), lookup(domain, 'DS'), lookup(domain, 'CAA')]);
  if (!txt || !dmarc) return null;
  // TXT může být rozdělený na víc řetězců v uvozovkách: "v=spf1 …" "… ~all"
  const texts = (res, type) => (res.Answer || []).filter(a => a.type === type).map(a => a.data.replace(/"\s*"/g, '').replace(/^"|"$/g, '').trim());
  const count = (res, type) => (res ? (res.Answer || []).filter(a => a.type === type).length : null);
  return { txt: texts(txt, 16), dmarc: texts(dmarc, 16), mx: count(mx, 15) || 0, ds: count(ds, 43), caa: count(caa, 257) };
}
