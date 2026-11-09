// Mobilní kontakt se ukáže při návratu nahoru, při čtení směrem dolů ustoupí.
const cta = document.createElement('div');
cta.className = 'sticky-mobile-cta';
cta.setAttribute('role', 'region');
cta.setAttribute('aria-label', 'Rychlý kontakt');
const contact = document.getElementById('kontakt');
const contactHref = contact ? '#kontakt' : '/#kontakt';
cta.innerHTML = '<a href="' + contactHref + '">Mám zájem <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></a>';
document.body.appendChild(cta);

const link = cta.querySelector('a');
const mobile = window.matchMedia('(max-width: 768px)');
let lastY = Math.max(0, window.scrollY);
let goingUp = false;
let pending = false;

function update() {
  pending = false;
  // Clamp iOS overscroll so the bounce at either edge does not reverse direction.
  const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const y = Math.max(0, Math.min(window.scrollY, maxY));
  const delta = y - lastY;
  // Ignore small movements to prevent flicker during slow scrolling.
  if (Math.abs(delta) >= 8 || y === 0) {
    goingUp = delta < 0;
    lastY = y;
  }
  const atContact = contact && contact.getBoundingClientRect().top < window.innerHeight * 0.85;
  const show = mobile.matches && y > 500 && goingUp && !atContact;
  cta.classList.toggle('visible', show);
  cta.setAttribute('aria-hidden', String(!show));
  cta.inert = !show;
  link.tabIndex = show ? 0 : -1;
  document.body.classList.toggle('mobile-cta-visible', show);
}

function scheduleUpdate() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(update);
}

window.addEventListener('scroll', scheduleUpdate, { passive: true });
window.addEventListener('resize', scheduleUpdate, { passive: true });
update();
