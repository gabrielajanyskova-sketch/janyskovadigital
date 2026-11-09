# Rozpoznávání odkazu na ochranu osobních údajů

Podnět: uživatelka předala ověření, že odkaz u formuláře a v patičce existuje, cílová právní stránka vrací 200 a oddíl je dostupný. Přesná cílová URL a původní HTML konkrétního odkazu zatím nebyly předány. Produkční chování nebylo nezávisle reprodukováno.

Ve zdroji testeru nalezena konkrétní slabina: privacyLink rozpoznával pouze klíčová slova v href. Odkaz s názvem Ochrana osobních údajů na obecnou stránku /legal nebo /pravni-informace tak mohl být přehlédnut.

Oprava zkoumá text odkazu (včetně vnořených elementů a entit), aria-label, title a adresu včetně kotvy. Podporuje diakritiku i procentní kódování URL. Nadále vyžaduje skutečný odkaz s HTTP(S) cílem nebo neprázdnou kotvou; samotná zmínka GDPR, komentář, skript, prázdný href nebo javascript: není důkaz odkazu. Pozitivní výsledek potvrzuje nalezený odkaz, nikoli právní správnost dokumentu či dostupnost konkrétního oddílu. Negativní výsledek vysvětluje i možnost dynamicky načteného obsahu.

Ověřeno v testwebu/test/review.mjs: 10 pozitivních podob odkazu a 8 negativních případů, včetně obecné právní adresy a kotvy. Celá sada testwebu prošla; po doplnění kotvy osobni-udaje znovu prošlo všech 14 testovacích skupin rozboru/pravidel. Build a kontrola 49 stránek prošly. Žádné produkční nasazení.
