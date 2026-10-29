// Vytáhne z HTML stránky fakta pro audit. Bez DOM (běží ve Workers), proto tolerantní regulární výrazy
// nad tagy: na audit stačí, nepotřebujeme přesný strom dokumentu.

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…',
  copy: '©', reg: '®', laquo: '«', raquo: '»', bdquo: '„', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
};
export function decode(s) {
  return String(s || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

const text = html => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

// Atributy jednoho tagu → objekt (názvy malými písmeny)
export function attrs(tag) {
  const out = {};
  const inner = tag.replace(/^<[a-z0-9-]+/i, '');
  for (const m of inner.matchAll(/([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return out;
}

const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map(m => attrs(m[0]));

const THIRD_PARTY = [
  ['Google Analytics', /google-analytics\.com|googletagmanager\.com\/gtag|gtag\(/],
  ['Google Tag Manager', /googletagmanager\.com\/gtm\.js/],
  ['Meta Pixel', /connect\.facebook\.net|fbq\(/],
  ['Hotjar', /static\.hotjar\.com/],
  ['Microsoft Clarity', /clarity\.ms/],
  ['Seznam Sklik', /c\.seznam\.cz|ssp\.seznam\.cz/],
  ['TikTok Pixel', /analytics\.tiktok\.com/],
  ['LinkedIn Insight', /snap\.licdn\.com/],
  ['Google Ads', /googleadservices\.com|googlesyndication\.com/],
  ['Smartsupp', /smartsuppchat\.com/],
  ['YouTube vložené video', /youtube\.com\/embed|youtube-nocookie\.com/],
  ['Google Mapy', /google\.com\/maps\/embed|maps\.googleapis\.com/],
];

const PLATFORMS = [
  ['WordPress', /wp-content\/|wp-includes\/|<meta[^>]+generator[^>]+WordPress/i],
  ['Wix', /static\.wixstatic\.com|<meta[^>]+generator[^>]+Wix/i],
  ['Webnode', /<meta[^>]+generator[^>]+Webnode|webnode\.(cz|com)\/[a-z_]*\/?(js|css|_files)|\.webnode\.page/i],
  ['Shoptet', /cdn\.myshoptet\.com|<meta[^>]+generator[^>]+Shoptet/i],
  ['Squarespace', /static1\.squarespace\.com/i],
  ['Shopify', /cdn\.shopify\.com/i],
  ['Webflow', /website-files\.com|<html[^>]+data-wf-site/i],
  ['Joomla', /<meta[^>]+generator[^>]+Joomla/i],
  ['Elementor', /\/plugins\/elementor\/|class="[^"]*\belementor-[a-z]/i],
];

export function analyzeHtml(html, pageUrl) {
  const base = new URL(pageUrl);
  const headEnd = html.search(/<\/head>/i);
  const head = headEnd > 0 ? html.slice(0, headEnd) : html;
  const bodyStart = html.search(/<body\b/i);
  const body = bodyStart >= 0 ? html.slice(bodyStart) : html;
  const bodyNoScripts = body.replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, ' ');

  const metas = tags(head, 'meta');
  const meta = name => metas.find(m => (m.name || '').toLowerCase() === name)?.content;
  const prop = name => metas.find(m => (m.property || '').toLowerCase() === name)?.content;
  const links = tags(head, 'link');
  const rel = r => links.filter(l => (l.rel || '').toLowerCase().split(/\s+/).includes(r));

  const headings = [...bodyNoScripts.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map(m => ({ level: +m[1], text: text(m[2]).slice(0, 160) }));

  const images = tags(bodyNoScripts, 'img').map(i => ({
    src: i.src || i['data-src'] || '', alt: i.alt, hasAlt: 'alt' in i,
    hasSize: !!(i.width && i.height), lazy: i.loading === 'lazy',
  }));

  const jsonLd = [];
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1].trim());
      const types = [];
      const walk = o => {
        if (Array.isArray(o)) return o.forEach(walk);
        if (o && typeof o === 'object') {
          if (o['@type']) types.push(...[].concat(o['@type']));
          if (o['@graph']) walk(o['@graph']);
          Object.values(o).forEach(v => typeof v === 'object' && walk(v));
        }
      };
      walk(data);
      jsonLd.push({ valid: true, types: [...new Set(types)] });
    } catch (e) {
      jsonLd.push({ valid: false, error: e.message.slice(0, 120) });
    }
  }

  const anchors = tags(bodyNoScripts, 'a').filter(a => a.href);
  const internal = new Set();
  let external = 0;
  for (const a of anchors) {
    let u;
    try { u = new URL(a.href, base); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    if (u.hostname.replace(/^www\./, '') === base.hostname.replace(/^www\./, '')) { u.hash = ''; internal.add(u.href); }
    else external++;
  }

  const scripts = tags(html, 'script');
  const scriptSrcs = scripts.map(s => s.src).filter(Boolean);
  const stylesheets = links.filter(l => (l.rel || '').toLowerCase().includes('stylesheet')).map(l => l.href);
  const resourceUrls = [...scriptSrcs, ...stylesheets, ...images.map(i => i.src)];
  const mixedContent = base.protocol === 'https:'
    ? resourceUrls.filter(u => /^http:\/\//i.test(u || '')) : [];

  const words = text(bodyNoScripts).split(/\s+/).filter(w => /\p{L}/u.test(w)).length;

  return {
    lang: (html.match(/<html\b[^>]*\blang\s*=\s*["']?([a-zA-Z-]+)/i) || [])[1] || null,
    title: text((head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '') || null,
    description: meta('description') ?? null,
    robots: meta('robots') ?? null,
    viewport: meta('viewport') ?? null,
    generator: meta('generator') ?? null,
    canonical: rel('canonical')[0]?.href ? new URL(rel('canonical')[0].href, base).href : null,
    hreflang: links.filter(l => (l.rel || '').toLowerCase() === 'alternate' && l.hreflang).length,
    favicon: rel('icon').length + rel('shortcut').length > 0,
    og: { title: prop('og:title'), description: prop('og:description'), image: prop('og:image'), url: prop('og:url') },
    twitterCard: meta('twitter:card') ?? null,
    charset: /<meta\b[^>]*charset/i.test(head),
    headings,
    images,
    jsonLd,
    internalLinks: [...internal],
    externalLinks: external,
    words,
    scripts: scriptSrcs.length,
    inlineScripts: scripts.filter(s => !s.src && !(s.type || '').includes('json')).length,
    stylesheets: stylesheets.length,
    googleFonts: /fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(html),
    thirdParty: THIRD_PARTY.filter(([, re]) => re.test(html)).map(([name]) => name),
    platforms: PLATFORMS.filter(([, re]) => re.test(head + ' ' + scriptSrcs.join(' ') + ' ' + images.map(i => i.src).join(' ') + ' ' + (body.match(/<body\b[^>]*>/i) || [''])[0])).map(([name]) => name),
    mixedContent,
    cookieBanner: /cookie[-_ ]?(consent|banner|bar|lišta|lista)|cookiebot|onetrust|cookieyes|complianz|cc-window|klaro/i.test(html),
    privacyLink: /ochrana[-_ ]osobních|ochrana[-_ ]osobnich|gdpr|zásady[-_ ]ochrany|zasady[-_ ]ochrany|privacy/i.test(bodyNoScripts),
    phone: /(\+420\s?)?\d{3}\s?\d{3}\s?\d{3}/.test(text(bodyNoScripts)),
    email: /[\w.+-]+@[\w-]+\.[\w.]+/.test(text(bodyNoScripts)),
    forms: (body.match(/<form\b/gi) || []).length,
    // IČO podnikatele (§ 435 občanského zákoníku): „IČO: 12345678“, „IČ 123 45 678“
    ico: /I[ČC]O?\s*[:.]?\s*(\d\s?){8}/i.test(text(bodyNoScripts)),
  };
}
