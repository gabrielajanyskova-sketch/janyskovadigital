# janyskovadigital.cz

Statický web HTML/CSS/JS na Cloudflare Pages, bez redakčního systému. Obsah a články se upravují ve zdrojových souborech a sestavují přes Node.js 24 (viz `.nvmrc`). Používá se pouze tmavý vzhled.

## Vývoj

```bash
npm ci
npm test                 # kontakt, bezpečnost, build, kontrola HTML a obsahové regrese
npm run testwebu:test    # audit a zpracování PageSpeed na lokálních datech
npm run test:penetration # lokální HTTP útokové scénáře, externí služby simulované
```

`npm run build` generuje HTML, CSS, JS, hlavičky, sitemap a llms.txt. Generované soubory se neupravují ručně. Před commitem vždy sestavit a ověřit výstup.

| Cesta | Účel |
|---|---|
| `src/pages/` | Zdrojové stránky; články jsou HTML v `src/pages/blog/` |
| `src/partials/` | Sdílené bloky stránky |
| `src/data/home.json` | Sdílené texty úvodu a FAQ, běžný zdrojový JSON |
| `src/data/schema-business.json` | Jednotná fakta firmy a katalog nabídky pro úvod, města a llms.txt |
| `src/data/cities.json` | Městské texty; skutečné sídlo se nepřepisuje podle obsluhovaného města |
| `src/templates/city.html` | Městská šablona |
| `src/css/` | Základní styly, komponenty, stránky; žádný světlý motiv |
| `src/css/pages/` | Styly jednotlivých stránek, sestavují se do pages.css |
| `src/js/` | Frontendové moduly, společné modální chování a Turnstile |
| `functions/api/` | Kontakt přes Resend a veřejná konfigurace Turnstile |
| `functions/_lib/` | Limity požadavků a čtení těla s bajtovým limitem |
| `testwebu/` | Samostatná aplikace technického auditu |

Proměnné šablon: `{{home.hero_title}}`, `{{city.name}}`. Include: `<!-- @include nav about="/#o-mne" cenik="/#cenik" kontakt="/#kontakt" -->`. FAQPage se generuje z viditelných otázek a odpovědí. Karty blogu, sitemap a seznam článků v llms.txt se generují z článků. Nový článek přidejte jako HTML do `src/pages/blog/`, včetně metadat a data publikace; CMS ani Markdown se nepoužívají.

## Bezpečnost

Kontakt vyžaduje úspěšné serverové ověření Turnstile, povolený hostname a akci contact. Secret key se nikdy nevkládá do zdrojů. Konfigurace a přejímka: [Turnstile](docs/turnstile.md).

- `RESEND_API_KEY` a `TURNSTILE_SECRET_KEY` jsou secrets hlavního Pages projektu.
- Veřejný Site key je v kódu; lze jej přepsat proměnnou `TURNSTILE_SITE_KEY`.
- Lokální limit kontaktu je 3 požadavky za 10 minut na IP v jednom isolate; audit API má společný limit 12 požadavků za minutu.
- Pokud existují bindingy `CONTACT_LIMITER` / `AUDIT_LIMITER`, využijí se před lokálním fallbackem. Jejich skutečnou podporu a nastavení v daném prostředí je nutné ověřit; na jejich automatickou existenci se nespoléhá.
- Per-isolate limity nejsou globální distribuovaná ochrana. Před vydáním ověřit WAF/rate limiting a kvóty na Cloudflare. Vyhodnocení jednoho auditu zahrnuje až 3 API požadavky.
- DNS ověření je fail-closed, cíle se kontrolují před prvním stažením i při přesměrování; stejné domény se cachují pouze v rámci jednoho auditu. Samotný DNS preflight nezaručuje ochranu proti DNS rebindingu v okamžiku spojení. Produkční egress musí odmítat privátní adresy; to nelze potvrdit lokálními mocky.
- Skripty/styly se řídí CSP; Turnstile potřebuje challenges.cloudflare.com. Automatické kontaktní testy nenahrazují průchod skutečným widgetem.
- Platnost `.well-known/security.txt` kontroluje check.js. Neveřejné poznámky, klíče ani výpisy prostředí nepatří do repozitáře.

## Přístupnost a obsah

Modální menu a popup používají inertní pozadí, klávesnicový fokus a návrat na spouštěč. Na mobilu se automatický popup nezobrazuje. Respektuje se prefers-reduced-motion. Běžný text má mít kontrast alespoň 4,5 : 1. Zdrojové texty, viditelné FAQ a schémata se musí shodovat. Není nabízen paušál Web Care, pouze individuální úpravy po dohodě. Citace AI, pořadí ve vyhledávání ani absolutní bezpečnost se neslibují.

## Větve a vydání

Opravy se připravují na `fixes/audit-turnstile`. **Bez výslovného pokynu majitelky nepushovat, neslučovat do main a nenasazovat.** I push jiné větve může spustit Cloudflare preview; před prvním pushem ověřit nastavení obou Pages projektů.

GitHub Actions provádí testy a kontrolu aktuálnosti generovaných souborů na Node 24. Workflow má pouze čtecí oprávnění a nevytváří automatické commity, aby nevznikal druhý push. Nastavení skutečného deploymentu a podmínění jeho úspěchem CI se ověřuje samostatně v Cloudflare.

Před vydáním projít [přejímku a penetrační test](docs/bezpecnost-a-vydani.md). Externí klíče zadávat pouze do zabezpečeného nastavení, nikdy do chatu nebo Gitu.
