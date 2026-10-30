# Turnstile: připraveno k pozdějšímu společnému nasazení

Změna chrání kontakt, barter a žádost o osobní audit z testwebu. Zatím není nasazená. Neprovádět push ani deployment bez výslovného pokynu majitelky.

## Jednorázové nastavení v Cloudflare

1. Otevřít Cloudflare dashboard → Turnstile → Add widget (případně Add site).
2. Název například Janyskova Digital – formuláře. Typ widgetu Managed.
3. Přidat hostname `janyskovadigital.cz`, `www.janyskovadigital.cz` a `testwebu.janyskovadigital.cz`. Uvádět bez https a bez cest. Nezapínat pre-clearance; pro formulář není potřeba.
4. Zkopírovat veřejný Site key. Secret key nesdílet v chatu ani neukládat do Git repozitáře.
5. U hlavního Cloudflare Pages projektu (nikoli pouze testwebu) v Settings → Variables and Secrets nastavit:
   - Veřejný Site key `0x4AAAAAAFsO2XWvTMVxMmsT` je již doplněn v kódu. `TURNSTILE_SITE_KEY` je pouze volitelná běžná proměnná pro jeho přepsání.
   - `TURNSTILE_SECRET_KEY`: Secret key, typ Secret.
   Existující `RESEND_API_KEY` ponechat.
6. Nasazení hlavního webu i samostatného projektu testwebu domluvit společně. Nenasazovat pouze serverovou část bez formulářů a jejich CSP. Konfigurace musí být připravena před nasazením; bez ní budou formuláře záměrně odmítat odeslání.

Oba frontendové projekty načítají veřejný Site key z hlavního webu `/api/turnstile`. Auditovací subdoména proto nepotřebuje vlastní kopii klíčů. Endpoint povoluje CORS pouze pro tuto auditovací subdoménu; tajný klíč nevrací.

Na serveru musí Siteverify vrátit `success: true`, `action: contact` a přesný povolený hostname. Token se předává jako `cf-turnstile-response`, Cloudflare ověřuje i expiraci a jednorázovost. Chybějící, neplatné či opakovaně použité tokeny ani nedostupná ověřovací služba nesmějí vést k odeslání přes Resend. Honeypot zůstává jako další filtr.

## Ověření před a po nasazení

- Lokálně: `node test/contact.test.mjs` (19 testů včetně podtestů); `npm test` (test kontaktu, build, kontrola HTML); `npm run testwebu:test` (dosavadní auditovací testy).
- Unit testy používají simulované Siteverify a Resend. Neposílají skutečné e-maily a neověřují skutečný widget.
- Pro místní test widgetu použít samostatnou testovací konfiguraci a oficiální Turnstile testovací klíče; nepřidávat produkční bypass do handleru. Server pevně kontroluje produkční hostname, takže integraci s localhost je nutné testovat v odděleném harnessu nebo s mocky.
- Po společném nasazení ručně vyzkoušet kontakt na hlavním webu i městské stránce, barter a žádost o audit z testwebu; ověřit skutečné doručení a absenci CSP/CORS chyb v prohlížeči.
- Odeslání bez tokenu musí skončit odmítnutím bez e-mailu. Při vypršení ověření má být možné ověření obnovit. Při zablokovaném skriptu se zobrazí alternativní kontakt.

## Omezení

Widget byl založen uživatelkou a veřejný Site key doplněn do kódu. Tajný klíč je nutné vložit do nastavení hlavního Pages projektu. Prohlížečový průchod s platnými klíči zatím není ověřen. Kontakt má per-isolate limit 3 požadavků za 10 minut. Globální WAF/rate limiting je nutné samostatně ověřit před produkcí; lokální fallback nezaručuje distribuovaný limit. Turnstile omezuje automatické odesílání, nezaručuje odstranění ručně zadávaného spamu.
