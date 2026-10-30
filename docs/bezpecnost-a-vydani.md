# Přejímka před společným vydáním

Práce je na fixes/audit-turnstile. Bez výslovného pokynu majitelky žádný push, merge ani deployment.

## Hotové změny

- Odstraněn Decap CMS, OAuth handlery, administrace a nepoužívaná YAML závislost. Zdrojové texty jsou JSON a HTML.
- Odstraněn světlý motiv i přepínače; bezpečné chování při zakázaném storage.
- Zrušen paušál Web Care. Individuální úpravy pouze po dohodě, bez pevných částek.
- Turnstile pro kontakt, barter a audit lead; limit těla, lokální rate limiting a timeouty Resend.
- Audit kontroluje počáteční cíle i redirecty, blokuje privátní/reservované IP, mapped IPv6 a neověřitelnou DNS. Externí sitemap na jiné doméně se nenačítá.
- Opravené chyby streamů, PSI odpovědí, opakovaných robots skupin a skrytí interních výjimek.
- Modální fokus, návrat na spouštěč, malé obrazovky bez automatického popupu; přístupnější záložky, tabulky, kontrast a reduced motion.
- Jednotný katalog firmy, opravené domény vlastností Schema.org, ceny a identifikace IČO. FAQ vychází z viditelných odpovědí.
- Jazyková revize, opatrnější tvrzení, zdroje a přepracované neověřené zprávy/statistiky. Původní URL článků se zachovávají.
- Nové podrobnější stránky tvorby webu, e-shopu a referencí. Blogové karty se generují ze zdrojových článků.
- CI Node 24 a všechny testy včetně lokálního HTTP harnessu; žádné automatické commity z workflow.

## Lokální penetrační test

`npm run test:penetration` spouští místní HTTP server na náhodném loopback portu a volá skutečné handlery. Nemá parametr cílového webu. Siteverify, Resend, DNS a cizí stránky jsou simulované, takže neposílá skutečné zprávy ani nepoužívá produkční klíče.

Scénáře: chybějící/podvržený/prošlý token, neplatný hostname, replay, honeypot, vložení HTML do e-mailu, podvržení řádku předmětu, rate limiting, velké tělo, únik secretu, SSRF přes číselné IP, privátní DNS a sitemap, kontrola rychlosti s privátním vstupem. Unit/regresní sada navíc pokrývá mapped IPv6, DNS výpadky, redirecty, chyby streamu a chybné PSI odpovědi.

Úspěšný lokální test není certifikace bezpečnosti ani test produkční infrastruktury.

## Zbývá před produkcí

1. V obou Pages projektech ověřit preview deployments, produkční větev, adresář výstupu a vazbu na úspěšné CI. Automatický druhý commit byl odstraněn, přímou konfiguraci Cloudflare tato změna nepřepisuje.
2. Ověřit TURNSTILE_SECRET_KEY a skutečný průchod widgetem na povolených doménách. Majitelka oznámila, že nastavení provedla; z tohoto prostředí nebylo nezávisle ověřeno.
3. Ověřit distribuovaný WAF/rate limiting: POST /api/contact, POST /api/audit a GET /api/speed. Lokální Map je pouze per-isolate pojistka a po restartu se resetuje; neprokazuje globální limit.
4. Ověřit egress politiku Cloudflare proti privátním cílovým IP. DNS kontrola v aplikaci není pinning spojení a DNS rebinding zůstává produkčním požadavkem k ověření.
5. Otestovat reálné doručení a chyby kontaktu, barteru a žádosti z auditovací subdomény, včetně CORS/CSP a expirace tokenu.
6. Ověřit produkční HTTP hlavičky, 404, canonical/redirecty, sitemap, Rich Results a Search Console. Zde je veřejná doména blokovaná síťovou politikou; nic z toho nebylo nahrazeno odhadem.
7. Majitelka zkontroluje změny obchodních textů a přepracované články. Neověřené celosvětové statistiky byly odstraněny nebo změněny na kontextová doporučení; nebyly nahrazeny vymyšlenými daty.

## Veřejný bezpečnostní tester vs. pentest

Současná aplikace nabízí technickou kontrolu veřejně dostupných signálů, nikoli důkaz skutečné odolnosti webu nebo právního souladu. Automatickému skóre se nemá říkat penetrační test. Případný aktivní tester pouze pro ověřené vlastní domény by potřeboval ověření DNS/souboru, jasný rozsah a samostatný backend/limity. Tato veřejná aktivní služba není součástí této změny.

## Výsledek místní přejímky

- `npm test`: 19 kontaktních + 37 bezpečnostních + 5 obsahových testů, všechny prošly; build a kontrola 49 stránek.
- `npm run testwebu:test`: dosavadní testy prošly.
- `npm run test:penetration`: 28 úspěšných lokálních HTTP kontrol; skutečný Resend, Siteverify a cizí cíle se nevolaly.
- Chromium + axe: úvod desktop/mobil, město, blog, tabulkový článek a obě nové stránky služeb bez nálezů v kontrolovaných stavech. Testy Tab/Escape, obnovy fokusu, resize popupu, reduced motion a zakázaného storage prošly. Nejde o certifikaci WCAG.
- Zásadní rozdělení hlavní stránky bylo po pozdějším upřesnění majitelky odloženo; délka úvodu sama není považována za vadu.
- Obrázky pro náhledy 26 článků vytvořené lokálně; žádné změny v produkci.
