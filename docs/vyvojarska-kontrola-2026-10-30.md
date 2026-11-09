# Vývojářská kontrola a zpevnění aplikace

Větev: fixes/dalsi-kontrola-formulare-chat. Navazuje na opravy formulářů a mobilního chatu.

## Dokončené změny

- Cache výsledků snese chybu čtení, chybu zápisu i neplatný uložený JSON. Úspěšná kontrola se kvůli nefunkční cache nezmění na chybu.
- Souběžné požadavky stejné adresy v jednom izolátu sdílejí jednu výpočetní úlohu. Chybující úloha se uvolní a další pokus je možný.
- V jednom izolátu běží nejvýše 8 různých úloh, z toho nejvýše 2 technické audity. Cache hity a sdílení již rozběhnuté stejné úlohy mají přednost před odmítnutím nové práce. Nejde o globální omezení napříč Cloudflare.
- Nová verze klíčů cache odděluje výsledky nových kontrol od dříve uložených výsledků.
- Technický audit má společný 55s limit pro odchozí požadavky, včetně DNS a přesměrování, vedle limitů jednotlivých stažení. Limit neomezuje synchronní CPU práci; tu hlídá runtime.
- Nedokončená kontrola má příznak incomplete a vysvětlení. Timeout sitemapy, testovací 404 nebo security.txt se neoznačuje za důkaz chybějícího souboru. Neúplnost je vidět i v souhrnu a předvyplněné žádosti.
- DNS kontrola odmítá chybně strukturované odpovědi a rozpor NXDOMAIN mezi A/AAAA. Doplněny vyhrazené rozsahy IPv6 2001:2::/48 a 3fff::/20.
- Známé parametry hesel a přístupových klíčů v zadané adrese se odmítnou před voláním Googlu, na klientu i serveru. Nejde o detekci všech možných názvů tajných parametrů. Veřejné adresy zůstávají podmínkou použití.
- Chybějící PAGESPEED_API_KEY vrátí srozumitelnou chybu konfigurace bez pokusu volat Google.
- Opraven neplatný zbytek animace a přebytečná závorka v základních stylech. Build nově odmítne varování parseru CSS, místo aby poškozený zápis přešel.
- Čtyři hlavní zdroje CSS a tři stránky služeb/referencí přeformátovány do čitelného zápisu. CSS zůstává při sestavení minifikované; nebyla přidána další závislost. HTML po opětovném rozboru zachovává elementy, atributy i slova. Výstup hlavního CSS se liší pouze odstraněním neplatného fragmentu; platná animace zůstala zachovaná.

## Ověření

Nové testy v testwebu/test/resilience.mjs pokrývají sdílení souběžných měření, obnovení po chybě, výpadky cache, meze souběhu a uvolnění slotů, DNS rozpory, vyhrazené IPv6, chybějící API klíč, společný časový limit a adresy s tajnými parametry. Jsou součástí npm run testwebu:test.

Ověření hlavního webu: npm test, sestavení a kontrola 49 stránek. Lokální bezpečnostní harness testuje skutečné handlery se simulovanými externími službami; neposílá skutečné e-maily ani neútočí na produkční weby. Prohlížečové kontroly zahrnují mobil a desktop, opakované spuštění po timeoutu a práci s neúplným výsledkem.

## Co nelze potvrdit pouze tímto repozitářem

**DNS preflight není připnutí IP.** fetch stále sám rozlišuje cílovou doménu. Prohlídka DNS ani další kontrola stejného záznamu neodstraní časové okno DNS rebindingu. Do kódu se proto nepřidávalo falešné „vyřešení“ nebo nepodporovaný resolveOverride pro cizí domény.

Před prohlášením produkční ochrany za ověřenou je potřeba v aktuálním Cloudflare účtu doložit:

1. Současné vlastnosti a omezení odchozího fetch vůči privátním, lokálním a metadatovým adresám. Případné runtime ověření provádět proti vlastní izolované kontrolní infrastruktuře; ne proti interním službám ani cizím systémům.
2. Pokud runtime neumožní zaručit blokaci privátního egressu, izolovaný fetcher s vynucenou síťovou politikou a vazbou DNS → skutečné spojení. Samotná knihovna URL toto nemůže garantovat.
3. Skutečnou WAF politiku nebo limiter bindings pro /api/audit a /api/speed, nastavené limity Google API a ochranu kvót. Náhradní Map a nový souběhový limit platí pouze pro jeden izolát.
4. Přítomnost platného PAGESPEED_API_KEY a funkčnost Turnstile/Resend bez sdílení klíčů v chatu. Odesílání ověřit vlastní zprávou; nikoli cizími adresáty.
5. Skutečné limity CPU/paměti aktuálního tarifu a chování větších vstupů v nasazeném prostředí.

V tomto chatu není dostupný konektor pro správu Cloudflare účtu. Tyto body se nepovažují za ověřené. Během kontroly se neměnilo nastavení účtu Cloudflare; dokončení produkčního nasazení není potvrzené.


Závěrečná kontrola: 8 nových scénářů odolnosti, stávající bezpečnostní/obsahové a integrační testy prošly, 28 lokálních HTTP bezpečnostních kontrol prošlo. Ověřen společný timeout a úspěšné další spuštění. V prohlížeči potvrzeno odmítnutí citlivé adresy bez volání API a označení neúplných kontrol i v žádosti o audit. Při porovnání 10 stavů hlavního webu (desktop/mobil, úvod, ceník, weby, e-shop, reference) byly snímky po formátování shodné; pouze v testovacím porovnání byl skryt ukazatel scrollování, aby jeho průběžná animace nezkreslovala výsledek. Kontrola 49 stránek a git diff --check prošly.
