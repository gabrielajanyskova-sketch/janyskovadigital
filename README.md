# janyskovadigital.cz

Statický web (HTML/CSS/JS) hostovaný na Cloudflare Pages. Obsah hlavní stránky se dá upravovat v Decap CMS (`/admin`).

## Struktura

| Cesta | Co obsahuje |
|---|---|
| `src/pages/` | Zdrojové stránky (hlavní stránka, blog, právní stránky…) |
| `src/partials/` | Sdílené bloky: navigace, patička, kontakt, recenze, reference… |
| `src/templates/city.html` | Šablona městských stránek |
| `src/data/cities.json` | Texty a data jednotlivých měst |
| `src/data/schema-business.json` | Společná strukturovaná data firmy (JSON-LD) |
| `src/css/` | Styly – spojí se do `style.css`, hero styly do `landing.css` |
| `content/hlavni-stranka.yml` | Texty upravované přes CMS |
| `main.js` | Veškerý JavaScript webu |

Soubory `*.html` v kořeni a ve složkách, `style.css` a `landing.css` jsou **generované** – neupravujte je ručně, změny by se přepsaly.

## Práce s webem

```bash
npm install      # jednou
npm run build    # sestaví stránky ze src/
npm run check    # zkontroluje výstup
npm test         # obojí
```

- Include: `<!-- @include nav about="/#about" -->` vloží `src/partials/nav.html`, atributy jsou dostupné jako `{{about}}`.
- Proměnné: `{{cms.hero_title}}` (z CMS), `{{city.name}}` (městské stránky). Chybějící proměnná build zastaví.
- FAQ strukturovaná data (FAQPage) se generují automaticky z viditelných otázek na stránce.
- CSS a JS dostávají v odkazu otisk obsahu (`?v=…`), takže se po změně nenačte stará verze z cache.

`npm run check` hlídá: nenahrazené proměnné, title/description/canonical, jeden `h1`, IČO v patičce, platnost JSON-LD, rozbité interní odkazy a kotvy a obsah `sitemap.xml`. Stejná kontrola běží na GitHubu při každém pushi.

**Po úpravě v CMS** je potřeba spustit `npm run build` a výsledek commitnout (kontrola na GitHubu na to upozorní).

## Nový článek / město

- Článek: zkopírujte existující soubor v `src/pages/blog/`, upravte ho, přidejte do `blog.html`, `sitemap.xml` a `llms.txt`. Karta na hlavní stránce se doplní sama.
- Město: přidejte záznam do `src/data/cities.json` a URL do `sitemap.xml`.
