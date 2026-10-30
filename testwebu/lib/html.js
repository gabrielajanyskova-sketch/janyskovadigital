// Vytáhne z HTML stránky fakta pro audit. Bez DOM (běží ve Workers), proto tolerantní regulární výrazy
// nad tagy: na audit stačí, nepotřebujeme přesný strom dokumentu.

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…',
  copy: '©', reg: '®', laquo: '«', raquo: '»', bdquo: '„', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
};
export function decode(s) {
  const codePoint = n => Number.isInteger(n) && n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '\ufffd';
  return String(s || '')
    .replace(/&#(\d+);/g, (_, n) => codePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => codePoint(parseInt(n, 16)))
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

const normalizeLabel = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const privacyName = value => /\b(?:gdpr|privacy|soukromi|data[\s_-]+protection)\b|(?:ochran[a-z]*|zpracovan[a-z]*|zasad[a-z]*)[\s_-]+(?:osobn[a-z]*[\s_-]+)?udaj[a-z]*|osobn[a-z]*[\s_-]+udaj[a-z]*/.test(normalizeLabel(value));

function privacyLink(html, anchors, base) {
  const named = [...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a\s*>/gi)].map(m => ({
    ...attrs(m[0].match(/^<a\b[^>]*>/i)[0]), label: text(m[1]),
  }));
  return [...named, ...anchors].some(a => {
    const href = a.href?.trim();
    if (!href || href === '#') return false;
    let url;
    try { url = new URL(href, base); } catch { return false; }
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    let destination = url.pathname + url.search + url.hash;
    try { destination = decodeURIComponent(destination); } catch { /* text odkazu lze ověřit i při chybném escapování URL */ }
    return privacyName([a.label, a['aria-label'], a.title].filter(Boolean).join(' ')) ||
      privacyName(destination) || /(?:^|\/)(?:ochrana|privacy|gdpr)(?:[\/._-]|$)/i.test(destination);
  });
}

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
  // Komentáře nejsou viditelný obsah ani aktivní značky stránky.
  html = html.replace(/<!--[\s\S]*?-->/g, ' ');
  const base = new URL(pageUrl);
  const resolveUrl = value => { try { return new URL(value, base).href; } catch { return null; } };
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
    // /cdn-cgi/ jsou služební adresy Cloudflare (např. ochrana e-mailů před spamem), ne stránky webu
    if (u.hostname.replace(/^www\./, '') === base.hostname.replace(/^www\./, '') && !u.pathname.startsWith('/cdn-cgi/')) { u.hash = ''; internal.add(u.href); }
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
    canonical: rel('canonical')[0]?.href ? resolveUrl(rel('canonical')[0].href) : null,
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
    privacyLink: privacyLink(bodyNoScripts, anchors, base),
    phone: /(\+420\s?)?\d{3}\s?\d{3}\s?\d{3}/.test(text(bodyNoScripts)),
    // e-mail schovaný před spamem přes Cloudflare (Email Address Obfuscation) se počítá taky
    email: /[\w.+-]+@[\w-]+\.[\w.]+/.test(text(bodyNoScripts)) || /\/cdn-cgi\/l\/email-protection|__cf_email__/.test(body),
    forms: (body.match(/<form\b/gi) || []).length,
    // IČO podnikatele (§ 435 občanského zákoníku): „IČO: 12345678“, „IČ 123 45 678“
    ico: /I[ČC]O?\s*[:.]?\s*(\d\s?){8}/i.test(text(bodyNoScripts)),
  };
}
