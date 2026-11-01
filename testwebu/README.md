# Test webu (testwebu.janyskovadigital.cz)

Bezplatný automatický audit webu: rychlost (Google PageSpeed), technika a indexace (včetně blokace Googlu a Seznamu), SEO (i nefunkční odkazy), strukturovaná data a AI vyhledávače, bezpečnost, GDPR a důvěryhodnost (IČO podle § 435 OZ). Výsledek jde vytisknout (`@media print` v `app.css`). Samostatný projekt v Cloudflare Pages se stejným repozitářem jako hlavní web.

## Struktura

| Cesta | Co obsahuje |
|---|---|
| `public/` | Statická stránka aplikace (`index.html`, `app.css`, písma, `_headers` s CSP) |
| `src/app.js` | Logika stránky → `public/app.js` (sestaví `npm run build` v kořeni repozitáře) |
| `functions/api/audit.js` | `POST /api/audit`: technika, SEO, AI, bezpečnost, GDPR |
| `functions/api/speed.js` | `GET /api/speed?url=…&strategy=mobile\|desktop`: Google PageSpeed (15–40 s) |
| `lib/http.js` | Bezpečné stahování: jen veřejné adresy (ochrana SSRF i přes přesměrování a DNS), limity času a velikosti |
| `lib/html.js` | Rozbor HTML bez DOM (titulky, nadpisy, obrázky, schema, skripty třetích stran, platforma) |
| `lib/checks.js` | Pravidla auditu s vysvětlením a doporučením v češtině, výpočet skóre |
| `lib/psi.js` | Volání a zpracování PageSpeed Insights |
| `test/` | Lokální testy a vývojový server |

## Lokální vývoj

```bash
node testwebu/test/run.mjs                 # audit „špatného“ testovacího webu v konzoli
node testwebu/test/psi.mjs                 # zpracování výsledku PageSpeed
node testwebu/test/dev.mjs                 # aplikace na http://localhost:8788
```

Ve vývojovém serveru jsou fiktivní domény `spatny-web.test` (připravené chyby) a `dobry-web.test` (hlavní web na `localhost:8765`). PageSpeed se nahrazuje uloženým výsledkem.

## Nasazení (jednorázově)

1. Cloudflare → **Workers & Pages → Create → Pages → Connect to Git** → repozitář `janyskovadigital`.
2. Název projektu `testwebu`, produkční větev `main`.
3. Build: Framework **None**, Build command prázdný, Build output directory **`public`**, Root directory (Advanced) **`testwebu`**.
4. **Settings → Variables and Secrets**: `PAGESPEED_API_KEY` jako **Secret** (Production) → znovu nasadit.
5. **Custom domains** → `testwebu.janyskovadigital.cz`.
6. Ochrana proti zneužití: **Security → Security rules → Create rule → Rate limiting rules**
   - výraz: `http.host eq "testwebu.janyskovadigital.cz" and starts_with(http.request.uri.path, "/api/")`
   - charakteristika IP, **6 požadavků za 10 sekund**, akce **Block**, trvání 10 s (bezplatný tarif).
   - Jeden test = 3 požadavky (audit + rychlost mobil + počítač), takže běžný návštěvník limit nenarazí.

Výsledky stejné adresy se hodinu berou z cache (šetří kvótu Googlu a testované weby).

## Limity bezplatného tarifu Cloudflare

- **10 ms procesoru na požadavek:** PageSpeed se proto volá s `fields` (bez snímků obrazovky a překladů). Kdyby Google výběr odmítl (400), dotaz se zopakuje bez něj.
- **50 odchozích požadavků na volání:** audit má rozpočet 45 a kontrolu odkazů zkrátí podle zbývajícího rozpočtu.
- **Odpovědi 502/504** Cloudflare nahrazuje vlastní chybovou stránkou, proto chyby měření vrací 424.


## Odolnost a provozní kontrola

Technická kontrola má společný síťový limit 55 sekund. V jednom izolátu se sdílejí běžící kontroly stejné adresy a omezují nové souběžné úlohy (nejvýše 8 celkem, 2 technické audity). Nenahrazuje to WAF ani globální omezení požadavků. Výpadek cache neblokuje již získaný výsledek.

Omezení prohlídky DNS, DNS rebindingu a nutné ověření v účtu Cloudflare jsou v [dokumentaci vývojářské kontroly](../docs/vyvojarska-kontrola-2026-10-30.md). Netvrdit, že běžný fetch připíná cílovou IP nebo že lokální testy dokazují vlastnosti produkční sítě.

Další regresní testy: `node testwebu/test/resilience.mjs`, také součást `npm run testwebu:test`.

## Rozpoznávání technologií

Výsledek obsahuje tabulku systému, editoru a složek WordPress šablon nalezených ve veřejném HTML testované stránky. Rozpoznání je orientační a neovlivňuje skóre. Název složky nemusí být obchodním názvem šablony a více složek může patřit rodičovské i odvozené šabloně. Nerozpoznaný systém neznamená statický web. Neprovádíme další požadavky na soubory šablon.

Regresní test: `node testwebu/test/technology.mjs` (také součást `npm run testwebu:test`).

## Doména a poskytovatelé

Pro .cz (CZ.NIC), .com a .net (Verisign) načítáme veřejný RDAP z pevně povolených HTTPS adres bez následování přesměrování. V odpovědi testu a jeho cache zůstává pouze registrátor, expirace a zdroj, nikoli držitel ani jeho kontakty či celé odpovědi registru. Limit RDAP: 4,5 s a 128 KiB; používá společný rozpočet auditu. DNS NS přidává jeden dotaz, MX se používá z existující kontroly. Neúspěch této doplňkové kontroly nemění skóre. Datum expirace je údaj registru, ne termín fakturace zákazníka.

DNS a poštovní poskytovatelé jsou indicie podle konkrétních domén serverů. Hosting/CDN se odhaduje pouze z HTTP hlaviček. Cloudflare neoznačujeme jako prokázaný origin hosting. Podporu dalších koncovek přidávat až po ověření oficiálního endpointu a podmínek služby; nesledovat libovolné odkazy z RDAP odpovědi.

Zdroje: https://www.nic.cz/page/2256/rdap/ a https://www.verisign.com/news-insights/registration-data-access-protocol/help/ . Regresní test: `node testwebu/test/providers.mjs`.
