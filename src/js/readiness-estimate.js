// Prices come from the same catalogue as the public price list.
export function estimateReadiness(answers, catalogue) {
  const offers = catalogue.business.hasOfferCatalog.itemListElement;
  const shop =
    answers.scope === 2 || answers.goal === 1 || answers.features === 2;
  const name = shop
    ? 'E-shop na míru'
    : answers.scope === 1
      ? 'Web Business'
      : 'Web Start';
  const min = Number(
    offers.find((offer) => offer.itemOffered.name === name).price,
  );
  const max = name === 'Web Business' ? catalogue.estimates.businessMax : null;
  const extras = [];
  if (answers.features === 1 || answers.goal === 2)
    extras.push(
      'Rezervace: způsob napojení, cenu a případné poplatky externí služby upřesníme v nabídce.',
    );
  if (answers.features === 3)
    extras.push('Další funkce: cena po upřesnění požadavků.');
  if (answers.content !== 0)
    extras.push(
      'Chybějící podklady cenu automaticky nezvyšují. Případnou přípravu textů a fotografií nacením zvlášť, pokud si ji objednáte.',
    );
  if (answers.logo === 1)
    extras.push(
      'Překreslení loga: cena po posouzení podkladu, mimo uvedenou cenu webu.',
    );
  if (answers.logo === 2)
    extras.push(
      'Modernizace loga: individuální nabídka, mimo uvedenou cenu webu.',
    );
  if (answers.logo === 3)
    extras.push('Nové logo: individuální nabídka, mimo uvedenou cenu webu.');
  extras.push(
    'Doména a případné poplatky externích služeb nejsou zahrnuté. Hosting je v ceně tvorby; následné úpravy podle dohody.',
  );
  const provisional = answers.scope === 3 && !shop;
  return { name, min, max, extras, provisional };
}

export function formatEstimate(estimate) {
  const fmt = (value) =>
    String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  return estimate.max
    ? `${fmt(estimate.min)}–${fmt(estimate.max)} Kč`
    : `od ${fmt(estimate.min)} Kč`;
}
