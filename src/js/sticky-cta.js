// Plovoucí tlačítko „Mám zájem“ na mobilu

const cta = document.createElement('div');
cta.className = 'sticky-mobile-cta';
cta.setAttribute('role', 'region');
cta.setAttribute('aria-label', 'Rychlý kontakt');
const kontakt = document.getElementById('kontakt');
// Na stránkách bez kontaktního formuláře vede tlačítko na formulář na hlavní stránce
const kontaktHref = kontakt ? '#kontakt' : '/#kontakt';
cta.innerHTML = '<a href="' + kontaktHref + '">Mám zájem <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></a>';
document.body.appendChild(cta);

let shown = false;

window.addEventListener('scroll', function() {
  const past   = window.scrollY > 500;
  const atCta  = kontakt && kontakt.getBoundingClientRect().top < window.innerHeight * 0.85;
  const should = past && !atCta;
  if (should !== shown) { shown = should; cta.classList.toggle('visible', shown); }
}, { passive: true });
