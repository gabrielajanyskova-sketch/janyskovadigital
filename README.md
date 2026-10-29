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
| `src/css/pages/` | Styly jedné stránky (např. `blog/clanek.css` platí jen pro `/blog/clanek`) → `pages.css` |
| `src/js/` | JavaScript rozdělený podle funkcí (menu, formuláře, chatbot…) → `main.js` |
| `src/_headers` | HTTP hlavičky pro Cloudflare včetně Content-Security-Policy → `_headers` |
| `src/llms.txt` | Popis webu pro AI nástroje; seznam článků doplní build → `llms.txt` |
| `functions/api/` | Přihlášení do CMS přes GitHub (OAuth, ověřuje `state` a předává token jen vlastní doméně) |
| `content/hlavni-stranka.yml` | Texty upravované přes CMS |

Soubory `*.html` v kořeni a ve složkách, `style.css`, `landing.css`, `pages.css`, `main.js`, `_headers` a `llms.txt` jsou **generované** – neupravujte je ručně, změny by se přepsaly.

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
- Seznam článků ve schématu stránky Blog, karty na hlavní stránce a `llms.txt` se generují z článků; článek bez obrázku ve schématu BlogPosting dostane svůj `og:image`.
- CSS a JS dostávají v odkazu otisk obsahu (`?v=…`), takže se po změně nenačte stará verze z cache.
- JS i CSS minifikuje [esbuild](https://esbuild.github.io/).

### Bezpečnost (CSP)

Web posílá přísnou Content-Security-Policy: skripty a styly jen z vlastní domény.

- Žádné `onclick="…"`, `<script>` bez `src` ani `style="…"` v HTML. Chování patří do `src/js/`, vzhled do CSS.
- Výjimkou je kritický `<style>` a krátký `<script>` v hlavičce, který před vykreslením nastaví světlý/tmavý motiv (jinak by stránka problikla). Jejich hashe do CSP doplní build sám.
- Data pro Google (`<script type="application/ld+json">`) CSP neblokuje.

`npm run check` porušení těchto pravidel najde.

`npm run check` hlídá: nenahrazené proměnné, title/description/canonical, jeden `h1`, IČO v patičce, platnost JSON-LD, rozbité interní odkazy, kotvy a soubory, duplicitní `id`, přeskočené úrovně nadpisů, soulad s CSP a obsah `sitemap.xml`.

### Automatické sestavení

Při každém pushi na `main` (i po uložení v CMS) GitHub Action web sestaví, zkontroluje a sestavené soubory commitne. Cloudflare Pages pak nasadí výsledek. Pokud kontrola selže, nic se necommitne a na webu zůstane poslední funkční verze. Na ostatních větvích a v pull requestech se jen kontroluje.

## Nový článek / město

- Článek: zkopírujte existující soubor v `src/pages/blog/`, upravte ho (vlastní styly do `src/css/pages/blog/<název>.css`), přidejte kartu do `src/pages/blog.html` a URL do `sitemap.xml`. Karta na hlavní stránce, schéma blogu a `llms.txt` se doplní samy.
- Město: přidejte záznam do `src/data/cities.json` a URL do `sitemap.xml`.
