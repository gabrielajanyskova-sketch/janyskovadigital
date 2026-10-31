# Audit webu — 31. října 2026

Rozsah: všech 53 sestavených stránek hlavního webu, sdílené zdroje, frontend a API technického testeru. Z toho 50 stránek je určených k indexaci; 404, poděkování a ochrana údajů mají záměrně noindex. Audit proběhl nad pracovní kopií ve větvi `audit/seo-schema-code`. Produkční doménu blokuje proxy tohoto prostředí (CONNECT 403); nejde o zjištění chyby na samotném webu.

## Závěr

Statický web má přiměřenou architekturu: zdrojové šablony a sdílené části, moduly JavaScriptu, sestavení přes esbuild a automatické kontroly. Není důvod přepisovat jej do jiného frameworku. Nebyl nalezen problém vyžadující úplný přepis. Při auditu se ale našly konkrétní nedostatky v nových stránkách a kompatibilitě formulářů; opravy jsou popsané níže. Výsledek není certifikace bezpečnosti, přístupnosti ani záruka umístění ve vyhledávání.

## Nálezy a provedené opravy

| Oblast | Nález | Oprava |
| --- | --- | --- |
| Metadata | Reference a tři nové podstránky neměly kompletní metadata pro sdílení. | Sdílené doplnění chybějících Open Graph a Twitter údajů při sestavení; konkrétní nastavení stránky se zachovává. |
| Schema | Příprava webu, kalkulačka a FAQ neměly JSON-LD. | Identita stránky WebPage a navigační BreadcrumbList; FAQPage vzniká z viditelných otázek a odpovědí. Existující vnořená schémata se neduplikují. |
| SEO regresní ochrana | Původní kontrola ověřovala hlavně přítomnost canonical a syntaxi JSON. | Nové testy ověřují unikátní titulky, popisy a canonical, shodu og:url, pokrytí sitemapou, identitu stránky a viditelnost otázek ze schématu. |
| Sitemap | Úvod přebíral datum nejnovějšího článku, přestože už články nezobrazuje. | Datum článků zůstává pro blog; u úvodu se nepředstírá datum obsahové aktualizace. |
| Výkon | Hlavní obrázek ukázky na úvodu měl lazy loading. | Eager loading a vysoká priorita pro hlavní obrázek. Skutečný dopad na LCP musí ověřit měření živého webu. |
| Lokální identita | Poskytnutý odkaz na Google Maps nebyl součástí sdílených údajů firmy. | Doplněno hasMap. Skutečná adresa a souřadnice firmy zůstávají stejné i na městských stránkách. |
| AEO/GEO | llms.txt nezahrnoval nové nástroje. | Doplněny příprava zadání, kalkulačka, FAQ a reference. Ceny zůstávají navázané na společný katalog. |
| Formuláře | AbortSignal.timeout není dostupný ve starších Safari podporovaných cílem sestavení. | Sdílený timeout přes AbortController zahrnuje stažení i čtení odpovědi a vrací rozpoznatelnou chybu timeoutu. Používá jej kontakt i načtení konfigurace Turnstile, včetně aplikace Test webu. |
| Kompatibilita menu | Array.at není dostupné v Safari 14. | Standardní přístup k poslednímu prvku pole. |
| Údržba | Otázky testu byly duplicitně uložené v HTML a JavaScriptu. | HTML kroků se sestavuje ze stejného datového zdroje jako výsledky testu. |
| Styly | Horní odsazení nástrojů mělo více postupně přepisovaných definic. | Základní hodnoty sjednoceny; mobilní varianta zůstává samostatná. |
| Přístupnost | Malý růžový štítek testu byl těsně pod kontrastem 4,5 : 1. Pohyb tlačítek a počítadel nerespektoval omezené animace. | Světlejší barva štítku a respektování prefers-reduced-motion v JavaScriptu. |

## Výsledky kontroly

- `npm test`: 68 testů úspěšných, včetně sestavení a kontroly 53 stránek.
- `npm run testwebu:test`: všechny sady testeru úspěšné.
- `npm run test:penetration`: 28 lokálních HTTP scénářů úspěšných. Mail, ověření tokenů a externí weby jsou simulované; žádné produkční zprávy se neposílaly.
- `npm audit`: 0 hlášených známých zranitelností v okamžiku auditu. To není důkaz absence všech zranitelností.
- Chromium: všech 53 stránek při šířkách 320, 390 a 1440 px, tedy 159 kontrol. Bez zachycených běhových výjimek, bez přesahujícího neuzavřeného obsahu a bez vodorovného přesahu kořenové stránky. Nový Jičín vykazuje na 320 px subpixelové zaokrouhlení scrollWidth těla o 1 px; kořenová stránka nepřesahuje a viditelný obsah se vejde.
- Každá indexovatelná stránka má unikátní title a description, vlastní canonical, shodné og:url, úplná základní metadata pro sdílení, jeden H1 a platné JSON-LD. Všechny jsou v sitemapě. Obrázky všech 53 stránek mají alt, width a height. Délky title nepřesahují 70 znaků a description 190 znaků; nejde o garantované zobrazovací limity vyhledávačů.
- axe-core 4.11.0: úvod, příprava webu, kalkulačka, FAQ, tvorba webu, e-shop, Nový Jičín a jeden článek při 390 px, bez automaticky detekovaných porušení ve zvolených pravidlech WCAG A/AA. Kontrola proběhla se zapnutým omezením animací, aby přechodná průhlednost animace nezkreslila kontrast. Na každé stránce zůstává jeden automaticky nerozhodnutý výsledek; nenahrazuje to ruční audit ani test skutečného Turnstile widgetu.
- V dotčených nových modulech a sestavení sjednoceno formátování. Vygenerované soubory se neupravují ručně.

## SEO, AEO a GEO — praktické meze

Hlavní služby mají vlastní stránky, jasnou cenu od, viditelné vysvětlení rozsahu a kontaktní cestu. Články mají autorku, datum a související metadata. FAQ a ceník jsou čitelné přímo v HTML. Firemní identita a nabídka vycházejí ze společných dat; nepřidávají se fiktivní pobočky ani samoúčelné hodnocení AggregateRating.

GEO ve významu generativního vyhledávání a AEO stojí na dostupném, konkrétním a pravdivém obsahu. Schéma ani llms.txt nezaručují citace. Povolení botů v robots.txt je pouze pravidlo pro crawling, nikoli důkaz návštěv nebo indexace. FAQPage u běžného firemního webu nezaručuje rozšířený výsledek v Googlu; jeho dostupnost je omezená podle pravidel vyhledávače.

## Co se musí ověřit na produkci

1. Skutečné HTTP odpovědi a hlavičky na čistých URL, přesměrování www/HTTPS/.html a opravdová 404. Zvlášť ověřit, že pravidla X-Robots-Tag pro alternativní .html URL nezpůsobují noindex čistých URL po interním routování Cloudflare.
2. Google Search Console: indexace, zvolený canonical, přijetí sitemap a reálné vyhledávací dotazy. Tyto údaje nejsou v repozitáři.
3. Google Rich Results Test a Schema.org Validator nad nasazenými URL. Lokální validace syntaxe a konzistence není úplná validace pravidel každého vyhledávače.
4. PageSpeed/Lighthouse a terénní Core Web Vitals; rychlost nebyla nahrazena odhadovaným skóre.
5. Průchod skutečným Turnstile, doručení e-mailu, CSP, distribuované rate limiting/WAF, DNS a ochrana proti DNS rebindingu. Dosavadní dokumentace bezpečnostní přejímky zůstává v platnosti.
6. Ruční průchod na iOS/Safari a s odečítačem obrazovky; emulace rozměrů v Chromiu není test Safari.

## Zbývající technický dluh

Sdílené CSS je stále rozsáhlé a obsahuje historické definice. Další dělení komponent by zlepšilo údržbu, ale samo nezlepší SEO. Sestavení používá regulární výrazy nad řízenými HTML šablonami; nejde o univerzální HTML parser. Při zásadní změně struktury šablon je nutné zachovat testy nebo přejít na parser. Rozsáhlý přepis těchto částí není podmínkou pro opravy z tohoto auditu.

## Navazující zkrácení městských stránek

Všech 14 měst používá kratší šablonu se sedmi hlavními bloky, dvěma ukázkami práce a třemi místními FAQ. Místní odstavce, skutečné sídlo firmy, canonical a schema zůstávají zachované. Přibyl regresní test stručnosti šablony; aktuální `npm test` má 69 úspěšných testů. Návrh měst je pouze v pracovní větvi, nikoli na produkci.
