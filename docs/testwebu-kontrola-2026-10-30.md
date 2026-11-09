# Kontrola Testu webu – 30. 10. 2026

Změny připravené ve větvi fixes/lokalni-seo-search-console, bez nasazení a bez testování cizích produkčních systémů.

## Opravené problémy

- DMARC s neplatnou/chybějící politikou, duplicitními značkami nebo více záznamy se již neoznačuje za správný. U pct=0 a částečného rozsahu je výsledek rozlišený. p=none bez rua neslibuje zasílání hlášení.
- Chybějící MX se nepoužívá jako důkaz, že doména nic neodesílá. Doporučení SPF -all je podmíněné skutečným nepoužíváním odesílání. Úspěšný nález omezujícího SPF není označen za úplnou validaci.
- Chyby DNS SERVFAIL/REFUSED a částečné chyby zůstávají neověřenými údaji místo falešného závěru o chybějících ochranných záznamech.
- Výpadek robots.txt nevede k tvrzení o povoleném přístupu AI. Rozlišeni roboti pro vyhledávání a trénování; llms.txt a záměrné blokování trénování neovlivňují skóre.
- Nenastahované podstránky se nehodnotí jako stránky bez H1/popisu. Nedostupné a blokované odkazy se odlišují od chybových odpovědí. Velké HTML nad 3 MB se odmítne místo tichého skórování neúplného obsahu.
- Rozbor HTML se nezhroutí na neplatné číselné entitě nebo chybné canonical URL. Komentáře se nepočítají do nadpisů ani aktivních značek. Odstraněn násobný průchod vnořeným JSON-LD @graph.
- Cizí navigace nemůže přes sec-fetch-mode obejít kontrolu původu API. To není autentizace; ochrana kvót nadále vyžaduje limity.
- Nedokončené Lighthouse měření se nevrací jako úspěšné měření. Frontend zobrazuje průběžné/neúplné výsledky, ukončí čekání po timeoutu a odděluje stav každého spuštění.
- Rozbalené nálezy a zaměření klávesnice se zachovají po doplnění rychlosti. Kategorie bez výsledků nemají odkazy na neexistující sekce. Neúplnost měření je uvedena také ve zprávě z formuláře.
- Hodnocení neslibuje bezpečný web, splnění GDPR, pochopení AI ani lepší pozice podle samotné délky metadat. Hlavičky/JSON-LD/DS/CAA jsou popsány jako kontroly přítomnosti či zápisu, ne úplné validace.
- Text o údajích již neslibuje, že aplikace nezpracovává žádné osobní údaje nebo že data po hodině určitě fyzicky smaže. Uvedeno využití mezipaměti, Googlu a provozních údajů; formulář odkazuje na zásady a jejich text doplněn o Test webu.
- Build synchronizuje viditelné FAQ také uvnitř JSON-LD @graph aplikace, aby se texty nerozcházely.

## Sdílení

Open Graph i Twitter metadata jsou přímo v HTML, takže nevyžadují spuštění JavaScriptu robotem. Obrázek 1200 × 630 PNG je uložen přímo v projektu Testu webu jako public/og-test-webu.png; využívá existující grafiku značky. Náhled představuje aplikaci, nikoli konkrétní skóre. Na podporovaných zařízeních je systémové Sdílet, vedle něj zůstává kopírování odkazu. Volba WhatsAppu je na návštěvníkovi; aplikace nic neposílá automaticky.

Zobrazení ve skutečném WhatsAppu vyžaduje veřejné nasazení. Jeho mezipaměť a nastavení zařízení mohou ovlivnit náhled. Sdílený odkaz znovu otevře test téže adresy, nejde o uložený historický report.

## Ověření

- Bezpečnostní testy: 37/37.
- Nové regresní scénáře v testwebu/test/review.mjs: 12/12, přidané do npm run testwebu:test.
- Existující integrační a PSI testy aplikace prošly.
- Lokální HTTP bezpečnostní harness: 28 kontrol prošlo, všechny externí služby a pošta nahrazeny testovacími odpověďmi.
- Chromium 1440/390 px: úvod i celý výsledek proti fiktivnímu webu, bez vodorovného přetečení a bez nálezů axe pro kontrolované WCAG A/AA. Zachování rozbaleného nálezu po pozdním měření ověřeno.
- Simulace 100s timeoutu v prohlížeči: neúplný výsledek, konec indikace čekání, dostupné opakování testu a úspěšný další test. Systémové sdílení ověřeno testovacím navigator.share, bez skutečného odesílání.
- PNG je lokálně dostupné s image/png; FAQ odpovídá viditelnému textu.

## Hranice kontroly a navazující doporučení

Nejde o produkční pentest. Kontrola DNS před fetch není připnutí cílové IP; ochranu privátního egressu a DNS rebinding je nadále potřeba ověřit v Cloudflare. Náhradní limit požadavků v paměti izolátu není distribuovaný; ověřit skutečné nastavení WAF/limiterů v produkci.

Výběr základní domény používá zjednodušené pravidlo, nikoli celý Public Suffix List; u zvláštních veřejných suffixů mohou e-mailové záznamy vyžadovat ruční kontrolu. SPF, DKIM, shoda domén, plný řetězec DNSSEC a obsah CSP se plně nevalidují. Robots parser hodnotí základní pravidla kořenové cesty, ne veškeré kombinace cest a wildcard pravidel. HTML se vyhodnocuje bez spuštění skriptů; cookie souhlas, dynamický obsah a všechny právní povinnosti automatický test nepotvrdí.

## Indexace hlavního webu

V aktuálních zdrojích mají /ochrana-udaju, /podekovani a /404.html noindex a nejsou v hlavní sitemapě. Běžné stránky a kořen Testu webu nemají zákaz indexace. Dodaný výkonnostní export potvrzuje existující zobrazení části webu; úplnou indexaci všech adres musí potvrdit Search Console. Nastavení v repozitáři není důkaz aktuálního nasazení.
