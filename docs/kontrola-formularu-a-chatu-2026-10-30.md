# Další kontrola – formuláře a chat, 30. 10. 2026

Větev fixes/dalsi-kontrola-formulare-chat, bez publikování.

## Ověřené nálezy a opravy

1. Barterový formulář při chybě odpovědi pouze obnovil tlačítko, bez zprávy uživateli. Při simulované odpovědi 429 nebylo vidět žádné vysvětlení. Oba formuláře nyní zobrazují zprávu serveru (např. čekání 10 minut), chybu spojení či neověřené odeslání. Zachovají vyplněná pole a znovu umožní odeslání.
2. Chybové HTML místo JSON vedlo jen k obecné chybě. Formulář nyní bezpečně zpracuje i takovou odpověď a za úspěch uzná pouze úspěšný HTTP stav s success: true. Přidán 20s časový limit čekání; při timeoutu netvrdí, že zpráva určitě neodešla, a sám odeslání neopakuje.
3. Na mobilu byl panel chatu umístěný příliš nízko: tlačítko odeslání překrýval plovoucí přepínač. Reprodukováno při 390 px. Panel je výš, má výšku omezenou podle viewportu a vstup se může zúžit i na 320 px.
4. Escape zavíral chat, ale zaměření klávesnice zůstávalo na body. Nyní vrací focus na přepínač. Přidáno samostatné zavírací tlačítko, aktuální popisek přepínače a přístupný log zpráv. Odkaz do kontaktu při zavření focus nevrací, aby nepřebíjel další navigaci.
5. Na „Kolik stojí e-shop?“ chatbot odpovídal cenami prezentačních webů. Nyní rozpozná e-shop a uvádí cenu z centrálních dat nabídky i základní rozsah a další náklady. Jde stále o jednoduché klíčové odpovědi, ne AI poradce.
6. Záhlaví chatu „Gabriela / Online“ mohlo působit jako živá podpora. Nahrazeno „Rychlé odpovědi / Automatický pomocník“. Odpovědi o termínu a spolupráci sladěny se skutečným postupem popsaným uživatelkou.

## Ověření

- Předchozí chyby reprodukovány v místním prohlížeči.
- Chromium: chat 1440×900, 390×844 a 320×568; odeslání kliknutím, cena e-shopu, dostupný ovládací prvek, návrat focusu a viditelnost panelu.
- Kontakt i barter: simulované 429, 502 s HTML místo JSON, zachování polí, opakování a úspěšné přesměrování na poděkování. Žádná skutečná pošta ani skutečné ověřovací tokeny.
- npm test včetně sestavení a kontroly 49 stránek prošlo, git diff --check bez chyb.

Nejde o novou kompletní korekturu všech textů nebo o produkční penetrační test. Úpravy se týkají frontendu, nikoli pravidel serverového ověřování Turnstile.
