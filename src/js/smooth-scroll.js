// Plynulý posun při kliknutí na kotvu v rámci stránky (#cenik, /#kontakt na hlavní stránce).
// Příchod z jiné stránky na /#kontakt skočí rovnou na místo (žádné rolování přes celou stránku)
// a kdo má v systému omezené animace, plynulý posun nedostane.

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

document.addEventListener('click', function(e) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const link = e.target.closest('a[href*="#"]:not(.skip-link)');
  if (!link || link.target) return;

  const url = new URL(link.href);
  if (!url.hash || url.origin !== location.origin || url.pathname !== location.pathname) return;
  const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
  if (!target) return;

  e.preventDefault();
  target.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  history.pushState(null, '', url.hash);
});
