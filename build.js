import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename } from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';

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

async function build() {
  const srcDir = 'content/blog';
  const outDir = 'blog';

  if (!existsSync(srcDir)) {
    console.log('Žádné markdown soubory v content/blog/');
    return;
  }

  const files = (await readdir(srcDir)).filter(f => f.endsWith('.md'));

  if (files.length === 0) {
    console.log('Žádné .md soubory k převodu.');
    return;
  }

  const cards = [];

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

    // Připrav blog kartu
    const monthCs = ['ledna','února','března','dubna','května','června','července','srpna','září','října','listopadu','prosince'];
    const d = new Date(data.date || new Date());
    const dateLabel = `${d.getDate()}. ${monthCs[d.getMonth()]} ${d.getFullYear()}`;
    cards.push({ slug, date: d, card: `<a href="/blog/${slug}" class="blog-card" role="listitem">
        <div class="blog-card-tag">${data.tag || 'Blog'} · ${dateLabel}</div>
        <h2>${data.title}</h2>
        <p>${data.description || ''}</p>
        <span class="read">Číst článek →</span>
      </a>` });
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

  console.log(`\nHotovo — převedeno ${files.length} příspěvků.`);
}

build().catch(console.error);
