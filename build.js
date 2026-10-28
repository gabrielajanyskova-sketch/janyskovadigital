// Sestavení webu: ze zdrojů v src/ vyrobí hotové stránky do kořene repozitáře.
//
//   src/pages/       zdrojové stránky (cesta = výsledná cesta na webu)
//   src/templates/   šablony generovaných stránek (městské stránky)
//   src/partials/    sdílené části: <!-- @include název klíč="hodnota" -->
//   src/data/        data (města, základ schématu firmy)
//   src/css/         styly → style.css a landing.css
//   content/         texty spravované přes CMS (/admin)
//
// Proměnné se píšou {{název}} nebo {{objekt.vlastnost}}. Chybějící proměnná build zastaví.

import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { createHash } from 'crypto';
import path from 'path';
import { parse as parseYaml } from 'yaml';

const read = p => readFile(p, 'utf8');
const hash = s => createHash('sha256').update(s).digest('hex').slice(0, 10);

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
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

async function homeBlogCards(count) {
  const articles = [];
  for (const file of await walk('src/pages/blog')) {
    const html = await read(file);
    const date = html.match(/<meta property="article:published_time" content="([^"]+)"/);
    if (!date) continue;
    const title = html.match(/<title>([^<]+)<\/title>/)[1].replace(/\s*[|—].*$/, '').trim();
    const description = html.match(/<meta name="description" content="([^"]+)"/)[1];
    const rawTag = (html.match(/class="article-tag">([^<]+)</) || [, 'Blog'])[1].trim();
    const tag = rawTag.replace(/\s*·\s*\p{L}+\s+\d{4}\s*$/u, '');
    articles.push({ slug: path.basename(file, '.html'), date: new Date(date[1]), title, description, tag });
  }
  articles.sort((a, b) => b.date - a.date);
  return articles.slice(0, count).map(a =>
    `<a href="/blog/${a.slug}" class="blog-card reveal"><div class="blog-tag">${a.tag} · ${MONTHS[a.date.getMonth()]} ${a.date.getFullYear()}</div><h3>${a.title}</h3><p>${a.description}</p><span>Číst článek →</span></a>`
  ).join('\n      ');
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

// ── Sestavení ────────────────────────────────────────────────────────────────

async function build() {
  // Styly a skript (verze = otisk obsahu, takže prohlížeč nikdy nedrží starou verzi)
  const styleCss = (await Promise.all(['01-base', '03-components', '04-pages'].map(f => read(`src/css/${f}.css`)))).join('\n');
  const landingCss = await read('src/css/landing.css');
  await write('style.css', styleCss);
  await write('landing.css', landingCss);

  const cms = parseYaml(await read('content/hlavni-stranka.yml'));
  const ctx = {
    cssv: hash(styleCss),
    landingv: hash(landingCss),
    jsv: hash(await read('main.js')),
    cms,
    homeBlog: await homeBlogCards(6),
  };

  let count = 0;
  for (const file of await walk('src/pages')) {
    const rel = path.relative('src/pages', file);
    const html = syncFaqSchema(await render(await read(file), ctx, rel), rel);
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
    await write(where, syncFaqSchema(await render(template, cityCtx, where), where));
    count++;
  }

  console.log(`✓ Sestaveno ${count} stránek, style.css (${ctx.cssv}), landing.css (${ctx.landingv}), main.js (${ctx.jsv})`);
}

build().catch(err => { console.error('✗', err.message); process.exit(1); });
