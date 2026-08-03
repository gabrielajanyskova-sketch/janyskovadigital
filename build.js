import { readdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename } from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import { parse as parseYaml } from 'yaml';

const NAV = `<nav role="navigation" aria-label="Hlavní navigace">
  <div class="container nav-inner">
    <a href="/" class="logo" aria-label="Janyskova Digital — zpět na začátek">Janyskova <em>Digital</em></a>
    <div class="nav-links">
      <a href="/#o-mne">O mně</a>
      <a href="/#cenik">Ceník</a>
      <a href="/barter">Barter</a>
      <a href="/blog">Blog</a>
      <a href="/#kontakt" class="cta">Mám zájem</a>
    </div>
    <button class="hamburger" id="hamburger" aria-label="Otevřít menu" aria-expanded="false" aria-controls="mobile-menu">
      <span></span><span></span><span></span>
    </button>
  </div>
</nav>
<div class="fullscreen-menu" id="mobile-menu" role="dialog" aria-label="Mobilní navigace" aria-hidden="true">
  <div class="menu-group">
    <div class="menu-group-label">O Janyskova Digital</div>
    <a href="/#o-mne" onclick="closeMenu()">O mně</a>
    <a href="/#cenik" onclick="closeMenu()">Ceník</a>
  </div>
  <div class="menu-group">
    <div class="menu-group-label">Služby</div>
    <a href="/barter" onclick="closeMenu()">Barter</a>
  </div>
  <a href="/blog" onclick="closeMenu()">Blog</a>
  <a href="/#kontakt" onclick="closeMenu()" class="menu-cta">Mám zájem</a>
  <div class="menu-sub">info@janyskovadigital.cz</div>
</div>`;

const FOOTER = `<footer>
  <div class="container">
    <div class="footer-grid">
      <div>
        <a href="/" class="footer-logo-link">Janyskova <em>Digital</em></a>
        <p class="footer-desc">Tvorba webů v čistém kódu. PageSpeed 100, hosting v ceně.</p>
      </div>
      <div>
        <div class="footer-heading">Navigace</div>
        <ul class="footer-links-list">
          <li><a href="/#o-mne">O mně</a></li>
          <li><a href="/#cenik">Ceník</a></li>
          <li><a href="/barter">Barter</a></li>
          <li><a href="/blog">Blog</a></li>
        </ul>
      </div>
      <div>
        <div class="footer-heading">Kontakt</div>
        <ul class="footer-links-list">
          <li><a href="mailto:info@janyskovadigital.cz">info@janyskovadigital.cz</a></li>
          <li><a href="tel:+420739395800">+420 739 395 800</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© 2026 Gabriela Janýšková · Starojická Lhota 45, 741 01 Starý Jičín</span>
      <a href="/ochrana-udaju">Ochrana osobních údajů</a>
    </div>
  </div>
</footer>`;

const JS = `<script src="/main.js?v=12" defer></script>`;

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
}

const monthCs = ['ledna','února','března','dubna','května','června','července','srpna','září','října','listopadu','prosince'];
function dateLabel(d) {
  return `${d.getDate()}. ${monthCs[d.getMonth()]} ${d.getFullYear()}`;
}

// Načte metadata z existujících blog HTML souborů (datum, tag, title, description)
async function readExistingBlogMeta(outDir) {
  const htmlFiles = (await readdir(outDir)).filter(f => f.endsWith('.html'));
  const articles = [];
  for (const file of htmlFiles) {
    const slug = basename(file, '.html');
    const html = await readFile(join(outDir, file), 'utf8');
    const dateMatch = html.match(/<meta property="article:published_time" content="([^"]+)"/);
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    const descMatch = html.match(/<meta name="description" content="([^"]+)"/);
    const tagMatch = html.match(/class="article-tag">([^<]+)</);
    const blogTagMatch = html.match(/class="blog-card-tag">([^<]+)</);
    if (!dateMatch) continue;
    const date = new Date(dateMatch[1]);
    const title = titleMatch ? titleMatch[1].replace(/\s*[|—].*$/, '').trim() : slug;
    const description = descMatch ? descMatch[1] : '';
    const tag = tagMatch ? tagMatch[1].trim() : (blogTagMatch ? blogTagMatch[1].split('·')[0].trim() : 'Blog');
    articles.push({ slug, date, title, description, tag });
  }
  return articles;
}

async function updateSitemap(newSlugs, newDates) {
  let xml = await readFile('sitemap.xml', 'utf8');
  const existingSlugs = new Set([...xml.matchAll(/blog\/([^<]+)<\/loc>/g)].map(m => m[1]));
  let additions = '';
  for (let i = 0; i < newSlugs.length; i++) {
    if (!existingSlugs.has(newSlugs[i])) {
      additions += `  <url><loc>https://janyskovadigital.cz/blog/${newSlugs[i]}</loc><lastmod>${newDates[i]}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>\n`;
    }
  }
  if (additions) {
    xml = xml.replace('</urlset>', additions + '</urlset>');
    await writeFile('sitemap.xml', xml, 'utf8');
    console.log(`✓ sitemap.xml aktualizován (+${newSlugs.length} nových URL)`);
  }
}

async function updateRedirects(newSlugs) {
  let redirects = await readFile('_redirects', 'utf8');
  let added = 0;
  for (const slug of newSlugs) {
    const line = `/blog/${slug}.html /blog/${slug} 301`;
    if (!redirects.includes(line)) {
      redirects += `\n${line}`;
      added++;
    }
  }
  if (added > 0) {
    await writeFile('_redirects', redirects, 'utf8');
    console.log(`✓ _redirects aktualizován (+${added} nových přesměrování)`);
  }
}

async function updateHomepageBlog(outDir) {
  const articles = await readExistingBlogMeta(outDir);
  articles.sort((a, b) => b.date - a.date);
  const top3 = articles.slice(0, 3);

  const cardsHtml = top3.map(a => {
    const label = `${a.tag} · ${dateLabel(a.date).replace(/\. /g, '. ').split(' ').slice(1).join(' ')}`;
    return `<a href="/blog/${a.slug}" class="blog-card reveal"><div class="blog-tag">${a.tag} · ${new Date(a.date).toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase())}</div><h3>${a.title}</h3><p>${a.description}</p><span>Číst článek →</span></a>`;
  }).join('\n      ');

  let indexHtml = await readFile('index.html', 'utf8');
  indexHtml = indexHtml.replace(
    /<!-- HOMEBLOG:START -->.*?<!-- HOMEBLOG:END -->/s,
    `<!-- HOMEBLOG:START -->\n      ${cardsHtml}\n      <!-- HOMEBLOG:END -->`
  );
  await writeFile('index.html', indexHtml, 'utf8');
  console.log('✓ index.html — 3 nejnovější články aktualizovány');
}

async function build() {
  const srcDir = 'content/blog';
  const outDir = 'blog';

  if (!existsSync(srcDir)) {
    console.log('Adresář content/blog neexistuje.');
  }

  const files = existsSync(srcDir)
    ? (await readdir(srcDir)).filter(f => f.endsWith('.md'))
    : [];

  if (files.length === 0) {
    console.log('Žádné .md soubory k převodu.');
  }

  const cards = [];
  const newSlugs = [];
  const newDates = [];

  for (const file of files) {
    const slug = basename(file, '.md');
    const raw = await readFile(join(srcDir, file), 'utf8');
    const { data, content } = matter(raw);
    const bodyHtml = marked.parse(content);

    const url = `https://janyskovadigital.cz/blog/${slug}`;
    const dateIso = data.date ? new Date(data.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const dateReadable = formatDate(data.date || new Date());

    const html = `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${data.title} | Janyskova Digital</title>
<meta name="description" content="${data.description || ''}">
<meta property="og:title" content="${data.title}">
<meta property="og:description" content="${data.description || ''}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="article">
<meta property="og:locale" content="cs_CZ">
<meta property="og:image" content="https://janyskovadigital.cz/og-image.png">
<meta property="article:published_time" content="${dateIso}">
<meta property="article:author" content="Gabriela Janýšková">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${url}">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="sitemap" type="application/xml" href="/sitemap.xml">
<meta name="google-site-verification" content="mgNcqEFOqWsfFpNu6nEBnMaQmOUbuSZT6J9JkmlaW2M">
<meta name="seznam-wmt" content="mHbCZLluKw46tN2Rnhuk6zSVQETrHyhh">
<meta name="geo.region" content="CZ-80">
<meta name="geo.placename" content="Nový Jičín">
<link rel="preload" href="/fonts/plus-jakarta-sans-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/plus-jakarta-sans-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/dm-serif-display-latin-regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/dm-serif-display-latin-italic.woff2" as="font" type="font/woff2" crossorigin>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BlogPosting","headline":${JSON.stringify(data.title)},"description":${JSON.stringify(data.description || '')},"image":"https://janyskovadigital.cz/og-image.png","author":{"@type":"Person","name":"Gabriela Janýšková","url":"https://janyskovadigital.cz"},"publisher":{"@type":"Organization","name":"Janyskova Digital","url":"https://janyskovadigital.cz"},"datePublished":${JSON.stringify(dateIso)},"inLanguage":"cs","url":${JSON.stringify(url)},"mainEntityOfPage":{"@type":"WebPage","@id":${JSON.stringify(url)}}}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Domů","item":"https://janyskovadigital.cz/"},{"@type":"ListItem","position":2,"name":"Blog","item":"https://janyskovadigital.cz/blog"},{"@type":"ListItem","position":3,"name":${JSON.stringify(data.title)},"item":${JSON.stringify(url)}}]}</script>
<link rel="stylesheet" href="/style.css?v=12">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
</head>
<body>
<div class="bg-blobs" aria-hidden="true"></div>
${NAV}
<main class="article-main">
  <div class="container">
    <a href="/blog" class="back">
      <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
      Zpět na blog
    </a>
    <div class="article-tag">${data.tag || 'Blog'}</div>
    <h1 class="article-title">${data.title}</h1>
    <div class="article-meta">
      <img src="/gabca-mobilni-verze.webp" alt="Gabriela Janýšková" class="author-avatar" width="34" height="34" loading="lazy">
      <span>Gabriela Janýšková</span>
      <div class="meta-dot"></div>
      <span>${dateReadable}</span>
      <div class="meta-dot"></div>
      <span>${data.read_time || '5 min čtení'}</span>
    </div>
    <article class="article-body">
      ${bodyHtml}
    </article>
    <div class="cta-box" style="margin-top:56px">
      <h3>Chceš web, <em>který funguje?</em></h3>
      <p>Napiš mi — první náhled máš do 48 hodin.</p>
      <a href="/#kontakt" class="btn-primary">Mám zájem o web</a>
    </div>
  </div>
</main>
${FOOTER}
${JS}
</body>
</html>`;

    const outPath = join(outDir, `${slug}.html`);
    await writeFile(outPath, html, 'utf8');
    console.log(`✓ ${outPath}`);

    const d = new Date(data.date || new Date());
    cards.push({ slug, date: d, card: `<a href="/blog/${slug}" class="blog-card" role="listitem">
        <div class="blog-card-tag">${data.tag || 'Blog'} · ${dateLabel(d)}</div>
        <h2>${data.title}</h2>
        <p>${data.description || ''}</p>
        <span class="read">Číst článek →</span>
      </a>` });

    newSlugs.push(slug);
    newDates.push(dateIso);
  }

  // Aktualizuj blog.html — vlož nové karty na začátek
  if (cards.length > 0) {
    cards.sort((a, b) => b.date - a.date);
    const cardsHtml = cards.map(c => c.card).join('\n      ');
    let blogHtml = await readFile('blog.html', 'utf8');
    blogHtml = blogHtml.replace(
      /<!-- CMS:START -->.*?<!-- CMS:END -->/s,
      `<!-- CMS:START -->\n      ${cardsHtml}\n      <!-- CMS:END -->`
    );
    await writeFile('blog.html', blogHtml, 'utf8');
    console.log(`✓ blog.html aktualizován (${cards.length} nových karet)`);
  }

  // Aktualizuj sitemap.xml a _redirects pro nové články
  if (newSlugs.length > 0) {
    await updateSitemap(newSlugs, newDates);
    await updateRedirects(newSlugs);
  }

  // Aktualizuj index.html podle content/hlavni-stranka.yml
  const ymlPath = 'content/hlavni-stranka.yml';
  if (existsSync(ymlPath)) {
    const ymlRaw = await readFile(ymlPath, 'utf8');
    const data = parseYaml(ymlRaw);
    let indexHtml = await readFile('index.html', 'utf8');
    for (const [key, val] of Object.entries(data)) {
      indexHtml = indexHtml.replace(
        new RegExp(`<!--CMS:${key}-->.*?<!--/CMS:${key}-->`, 's'),
        `<!--CMS:${key}-->${val}<!--/CMS:${key}-->`
      );
    }
    await writeFile('index.html', indexHtml, 'utf8');
    console.log('✓ index.html — texty aktualizovány');
  }

  // Aktualizuj 3 nejnovější články na hlavní stránce
  await updateHomepageBlog(outDir);

  console.log(`\nHotovo — zpracováno ${files.length} příspěvků z CMS.`);
}

build().catch(console.error);
