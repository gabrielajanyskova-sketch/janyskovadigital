// Sestavení webu: ze zdrojů v src/ vyrobí hotové stránky do kořene repozitáře.
//
//   src/pages/       zdrojové stránky (cesta = výsledná cesta na webu)
//   src/templates/   šablony generovaných stránek (městské stránky)
//   src/partials/    sdílené části: <!-- @include název klíč="hodnota" -->
//   src/data/        data (města, základ schématu firmy)
//   src/css/         styly → style.css a landing.css
//   src/css/pages/   styly jedné stránky (cesta = cesta stránky) → pages.css, omezené na danou stránku
//   src/js/          JavaScript (moduly) → main.js
//   (sitemap.xml se generuje z indexovatelných stránek)
//   src/llms.txt     popis webu pro AI nástroje (seznam článků se doplní) → llms.txt
//   src/_headers     HTTP hlavičky pro Cloudflare (CSP se doplní automaticky) → _headers
//   content/         texty spravované přes CMS (/admin)
//
// Proměnné se píšou {{název}} nebo {{objekt.vlastnost}}. Chybějící proměnná build zastaví.

import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { createHash } from 'crypto';
import path from 'path';
import { parse as parseYaml } from 'yaml';
import * as esbuild from 'esbuild';

const read = p => readFile(p, 'utf8');
const hash = s => createHash('sha256').update(s).digest('hex').slice(0, 10);
const cspHash = s => `'sha256-${createHash('sha256').update(s).digest('base64')}'`;

// Prohlížeče, pro které se CSS a JS překládá (vnořené CSS se rozbalí, moderní JS zůstane)
const TARGET = ['chrome90', 'safari14', 'firefox90'];

async function walk(dir, ext = '.html') {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p, ext));
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out.sort();
}

async function write(file, content) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, 'utf8');
}

// ── Šablonovací jádro ────────────────────────────────────────────────────────

const partialCache = new Map();
async function partial(name) {
  if (!partialCache.has(name)) partialCache.set(name, await read(`src/partials/${name}.html`));
  return partialCache.get(name);
}

const INCLUDE = /<!-- @include ([a-z0-9-]+)((?:\s+[a-zA-Z]+="[^"]*")*)\s*-->\n?/g;

async function expandIncludes(text, depth = 0) {
  if (depth > 10) throw new Error('Příliš hluboké vnoření @include');
  const found = [...text.matchAll(INCLUDE)];
  if (!found.length) return text;
  const parts = await Promise.all(found.map(async ([, name, attrs]) => {
    let body = await partial(name);
    for (const [, k, v] of attrs.matchAll(/([a-zA-Z]+)="([^"]*)"/g)) body = body.replaceAll(`{{${k}}}`, v);
    return expandIncludes(body, depth + 1);
  }));
  let i = 0;
  return text.replace(INCLUDE, () => parts[i++]);
}

function fillVars(text, ctx, where) {
  return text.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key) => {
    const val = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), ctx);
    if (val === undefined || val === null) throw new Error(`${where}: chybí proměnná {{${key}}}`);
    return String(val);
  });
}

async function render(text, ctx, where) {
  return fillVars(await expandIncludes(text), ctx, where);
}

// ── Pomocné funkce ───────────────────────────────────────────────────────────

const ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
function htmlToText(html) {
  return html
    .replace(/<!--.*?-->/gs, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/g, e => ENTITIES[e] ?? e)
    .replace(/\s+/g, ' ')
    .trim();
}

// FAQ ve strukturovaných datech musí odpovídat FAQ viditelnému na stránce.
// Proto se FAQPage vždy přegeneruje z viditelných otázek a odpovědí.
function visibleFaq(html) {
  const body = html.split('</head>')[1] || '';
  const patterns = [
    /<summary[^>]*>(.*?)<\/summary>\s*<p[^>]*>(.*?)<\/p>/gs,
    /class="faq-q">(.*?)<\/div>\s*<p class="faq-a">(.*?)<\/p>/gs,
  ];
  return patterns.flatMap(re => [...body.matchAll(re)].map(m => [htmlToText(m[1]), htmlToText(m[2])]));
}

function faqSchema(pairs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pairs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };
}

function syncFaqSchema(html, where) {
  const pairs = visibleFaq(html);
  return html.replace(/(<script type="application\/ld\+json">)(.*?)(<\/script>)/gs, (all, open, json, close) => {
    let data;
    try { data = JSON.parse(json); } catch (e) { throw new Error(`${where}: neplatné JSON-LD (${e.message})`); }
    const list = Array.isArray(data) ? data : [data];
    const i = list.findIndex(x => x['@type'] === 'FAQPage');
    if (i < 0) return all;
    if (!pairs.length) throw new Error(`${where}: FAQPage ve schématu, ale žádné viditelné FAQ`);
    list[i] = { ...faqSchema(pairs), ...(list[i]['@context'] ? {} : { '@context': undefined }) };
    if (!list[i]['@context']) list[i]['@context'] = 'https://schema.org';
    const out = Array.isArray(data) ? list : list[0];
    return open + JSON.stringify(out, null, json.includes('\n') ? 2 : 0) + close;
  });
}

// ── Karty nejnovějších článků na hlavní stránce ──────────────────────────────

const MONTHS = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];

async function readArticles() {
  const articles = [];
  for (const file of await walk('src/pages/blog')) {
    const html = await read(file);
    const date = html.match(/<meta property="article:published_time" content="([^"]+)"/);
    if (!date) continue;
    const title = html.match(/<title>([^<]+)<\/title>/)[1].replace(/\s*[|—].*$/, '').trim();
    const description = html.match(/<meta name="description" content="([^"]+)"/)[1];
    const rawTag = (html.match(/class="article-tag">([^<]+)</) || [, 'Blog'])[1].trim();
    const tag = rawTag.replace(/\s*·\s*\p{L}+\s+\d{4}\s*$/u, '');
    const slug = path.basename(file, '.html');
    const headline = (html.match(/"@type": ?"BlogPosting",[^]*?"headline": ?"([^"]+)"/) || [, title])[1];
    articles.push({ slug, url: `https://janyskovadigital.cz/blog/${slug}`, date: new Date(date[1]), title, headline, description, tag });
  }
  return articles.sort((a, b) => b.date - a.date);
}

function homeBlogCards(articles, count) {
  return articles.slice(0, count).map(a =>
    `<a href="/blog/${a.slug}" class="blog-card reveal"><div class="blog-tag">${a.tag} · ${MONTHS[a.date.getMonth()]} ${a.date.getFullYear()}</div><h3>${a.title}</h3><p>${a.description}</p><span>Číst článek →</span></a>`
  ).join('\n      ');
}

// Seznam článků ve schématu stránky Blog
function blogPostsJson(articles) {
  const posts = articles.map(a => ({
    '@type': 'BlogPosting',
    headline: a.headline,
    url: a.url,
    datePublished: a.date.toISOString().slice(0, 10),
  }));
  return JSON.stringify(posts, null, 2).replace(/\n/g, '\n  ');
}

// Článek bez obrázku ve schématu BlogPosting dostane svůj og:image (Google ho u článků vyžaduje)
function articleSchemaImage(html) {
  const og = html.match(/<meta property="og:image" content="([^"]+)"/);
  if (!og) return html;
  return html.replace(/(<script type="application\/ld\+json">)(.*?)(<\/script>)/gs, (all, open, json, close) => {
    const data = JSON.parse(json);
    let changed = false;
    for (const item of Array.isArray(data) ? data : [data]) {
      if (item['@type'] === 'BlogPosting' && !item.image) { item.image = og[1]; changed = true; }
    }
    return changed ? open + JSON.stringify(data, null, json.includes('\n') ? 2 : 0) + close : all;
  });
}

// ── Městské stránky ──────────────────────────────────────────────────────────

function cityJsonLd(city, business) {
  const s = city.schema;
  const url = `https://janyskovadigital.cz/${city.slug}/`;
  const biz = {
    ...business,
    description: s.businessDescription,
    areaServed: s.areaServed,
    ...(s.serviceArea ? { serviceArea: s.serviceArea } : {}),
    hasOfferCatalog: { ...business.hasOfferCatalog, name: s.catalogName },
  };
  const page = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': url,
    url,
    name: s.pageName,
    description: s.pageDescription,
    inLanguage: 'cs',
    isPartOf: { '@id': 'https://janyskovadigital.cz/#website' },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Domů', item: 'https://janyskovadigital.cz/' },
        { '@type': 'ListItem', position: 2, name: s.breadcrumbName, item: url },
      ],
    },
  };
  return JSON.stringify([biz, page], null, 2);
}

// ── CSS a JS ────────────────────────────────────────────────────────────────

async function minifyCss(css) {
  return (await esbuild.transform(css, { loader: 'css', minify: true, target: TARGET })).code;
}

// Styly jedné stránky (src/css/pages/blog/clanek.css) se obalí :where(.page-blog-clanek),
// takže platí jen na té stránce a nemění specifičnost selektorů.
async function pageStyles() {
  const scoped = new Map();
  const parts = [];
  for (const file of await walk('src/css/pages', '.css')) {
    const page = path.relative('src/css/pages', file).slice(0, -4);
    const scope = 'page-' + page.replaceAll('/', '-');
    scoped.set(page, scope);
    parts.push(`/* ${page} */\n:where(.${scope}){\n${await read(file)}\n}`);
  }
  return { css: await minifyCss(parts.join('\n')), scoped };
}

// Aplikace testwebu.janyskovadigital.cz (samostatný projekt v Cloudflare Pages, kořen testwebu/)
async function bundleTestWebu() {
  await esbuild.build({
    entryPoints: ['testwebu/src/app.js'],
    outfile: 'testwebu/public/app.js',
    bundle: true,
    minify: true,
    format: 'iife',
    target: TARGET,
    legalComments: 'none',
  });
}

async function bundleJs() {
  const result = await esbuild.build({
    entryPoints: ['src/js/main.js'],
    bundle: true,
    minify: true,
    format: 'iife',
    target: TARGET,
    write: false,
    legalComments: 'none',
  });
  return result.outputFiles[0].text;
}

function collectSitemap(html, list) {
  const head = html.split('</head>')[0];
  if (/name="robots" content="[^"]*noindex/.test(head)) return;
  const loc = (head.match(/rel="canonical" href="([^"]+)"/) || [])[1];
  if (!loc) return;
  const dates = [...head.matchAll(/"date(?:Modified|Published)": ?"(\d{4}-\d{2}-\d{2})/g)].map(m => m[1]).sort();
  list.push({ loc, lastmod: dates.pop() });
}

function collectInline(html, { styles, scripts }) {
  for (const [, css] of html.matchAll(/<style>(.*?)<\/style>/gs)) styles.add(css);
  for (const [, js] of html.matchAll(/<script>(.*?)<\/script>/gs)) scripts.add(js);
}

// ── Sestavení ────────────────────────────────────────────────────────────────

async function build() {
  // Styly a skript (verze = otisk obsahu, takže prohlížeč nikdy nedrží starou verzi)
  const styleCss = await minifyCss((await Promise.all(['01-base', '03-components', '04-pages', '05-light'].map(f => read(`src/css/${f}.css`)))).join('\n'));
  const landingCss = await minifyCss(await read('src/css/landing.css'));
  const { css: pagesCss, scoped } = await pageStyles();
  const mainJs = await bundleJs();
  await bundleTestWebu();
  await write('style.css', styleCss);
  await write('landing.css', landingCss);
  await write('pages.css', pagesCss);
  await write('main.js', mainJs);

  const cms = parseYaml(await read('content/hlavni-stranka.yml'));
  const ctx = {
    cssv: hash(styleCss),
    landingv: hash(landingCss),
    jsv: hash(mainJs),
    cms,
  };
  const articles = await readArticles();
  ctx.homeBlog = homeBlogCards(articles, 6);
  ctx.blogPostsJson = blogPostsJson(articles);
  const pagesLink = `<link rel="stylesheet" href="/pages.css?v=${hash(pagesCss)}">\n`;
  const inline = { styles: new Set(), scripts: new Set() };
  const sitemap = [];

  let count = 0;
  for (const file of await walk('src/pages')) {
    const rel = path.relative('src/pages', file);
    let html = articleSchemaImage(syncFaqSchema(await render(await read(file), ctx, rel), rel));
    const scope = scoped.get(rel.slice(0, -5));
    if (scope) {
      html = html.replace('</head>', pagesLink + '</head>').replace('<body>', `<body class="${scope}">`);
      if (!html.includes(`class="${scope}"`)) throw new Error(`${rel}: chybí <body> pro třídu ${scope}`);
    }
    collectInline(html, inline);
    collectSitemap(html, sitemap);
    await write(rel, html);
    count++;
  }

  const cities = JSON.parse(await read('src/data/cities.json'));
  const { business } = JSON.parse(await read('src/data/schema-business.json'));
  const template = await read('src/templates/city.html');
  for (const city of cities) {
    const faq = [[cms.faq1_q, cms.faq1_a], [cms.faq3_q, cms.faq3_a], ...city.faq.map(f => [f.q, f.a])];
    const cityCtx = {
      ...ctx,
      city,
      referencesHtml: (await Promise.all(city.references.map(r => partial(`ref-${r}`)))).join(''),
      faqHtml: faq.map(([q, a]) => `      <details class="faq-item reveal"><summary>${q}</summary><p>${a}</p></details>\n`).join(''),
      citiesSectionHtml: city.citiesSection || await partial('cities-grid'),
      cityJsonLd: cityJsonLd(city, business),
      faqJsonLd: JSON.stringify(faqSchema(faq.map(([q, a]) => [htmlToText(q), htmlToText(a)])), null, 2),
    };
    const where = `${city.slug}/index.html`;
    const html = syncFaqSchema(await render(template, cityCtx, where), where);
    collectInline(html, inline);
    collectSitemap(html, sitemap);
    await write(where, html);
    count++;
  }

  // Sitemap: všechny indexovatelné stránky; lastmod jen tam, kde ho známe (datum úpravy článku),
  // hlavní stránka a blog podle nejnovějšího článku (zobrazují jeho kartu)
  const newest = sitemap.filter(p => p.lastmod).map(p => p.lastmod).sort().pop();
  for (const p of sitemap) if (/^https:\/\/janyskovadigital\.cz\/(blog)?$/.test(p.loc)) p.lastmod = newest;
  const order = p => (p.loc.endsWith('.cz/') ? 0 : p.loc.endsWith('/blog') ? 1 : p.loc.includes('/blog/') ? 2 : 3);
  sitemap.sort((a, b) => order(a) - order(b) || (b.lastmod || '').localeCompare(a.lastmod || '') || a.loc.localeCompare(b.loc));
  await write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    sitemap.map(p => `  <url><loc>${p.loc}</loc>${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : ''}</url>`).join('\n') + '\n</urlset>\n');

  // llms.txt pro AI nástroje: seznam článků se doplní automaticky
  const llmsArticles = articles.map(a => `- [${a.headline}](${a.url}): ${a.description}`).join('\n');
  await write('llms.txt', (await read('src/llms.txt')).replace('{{llmsArticles}}', llmsArticles));

  // CSP povolí jen přesně ty inline <style> a <script>, které na webu jsou
  // (kritický styl a nastavení motivu před vykreslením v hlavičce)
  const headers = (await read('src/_headers'))
    .replace('{{cspStyleHashes}}', [...inline.styles].map(cspHash).join(' '))
    .replace('{{cspScriptHashes}}', [...inline.scripts].map(cspHash).join(' '));
  await write('_headers', headers);

  console.log(`✓ Sestaveno ${count} stránek, style.css (${ctx.cssv}), landing.css (${ctx.landingv}), pages.css (${scoped.size} stránek), main.js (${ctx.jsv})`);
}

build().catch(err => { console.error('✗', err.message); process.exit(1); });
