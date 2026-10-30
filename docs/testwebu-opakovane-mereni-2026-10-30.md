# Opakované měření Testu webu

Uživatelka upřesnila, že web není odmítnut: test stále zobrazuje starý výsledek, např. čas 13:23. Původní implementace četla při každém spuštění až hodinovou serverovou cache, a to i po ručním kliknutí na Otestovat web. Obnovení prohlížeče tuto serverovou cache neobcházelo. Skutečný stav požadavku z 13:23 v produkčních logách nebyl dostupný; chování potvrzeno z kódu a místním testem.

## Oprava

- Ruční odeslání adresy i nové tlačítko Změřit znovu vyžádají čerstvý technický audit a obě měření rychlosti.
- Otevření sdíleného odkazu dál smí použít cache a u výsledku je pak výslovně uvedeno, že obsahuje uložená data.
- Nové úspěšné měření přepíše uložený výsledek; při chybě se stará cache nemaže a neprohlašuje se za nové měření.
- Cache bypass neobchází IP limity, kontrolu URL ani meze souběhu. Souběžné požadavky o nový výsledek sdílejí běžící měření.
- Google může používat vlastní vyrovnávací paměť a Chrome UX Report obsahuje období posledních 28 dní. Nový požadavek proto nemusí znamenat jiné skóre nebo nové údaje od skutečných návštěvníků.

## Ověření

Regrese cache ověřuje přečtení starého výsledku, vynucené nové měření, přepsání uložených dat, sdílení souběhu a zachování cache při selhání. Devět scénářů odolnosti prošlo, stejně jako stávající testy aplikace a 28 lokálních HTTP bezpečnostních kontrol. V prohlížeči ověřeno načtení starého sdíleného výsledku, jeho označení, tlačítko Změřit znovu, opakované odeslání formuláře, příznak refresh pro všechny tři požadavky a nový zobrazený čas. Bez přetečení při šířce 390 px. Testy používaly falešná data, nikoli produkční měření zákaznického webu.

Připraveno ve větvi fixes/testwebu-nove-mereni, bez publikování.
