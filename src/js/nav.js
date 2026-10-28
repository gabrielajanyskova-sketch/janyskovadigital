// Mobilní navigace (celoobrazovkové menu)

const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobile-menu');

export function closeMenu() {
  if (!mobileMenu || !hamburger) return;
  mobileMenu.classList.remove('open');
  hamburger.classList.remove('open');
  hamburger.setAttribute('aria-expanded', 'false');
  mobileMenu.setAttribute('aria-hidden', 'true');
  mobileMenu.inert = true;
  document.body.style.overflow = '';
}

if (hamburger && mobileMenu) {
  const closeBtn = document.createElement('button');
  closeBtn.className = 'menu-close';
  closeBtn.setAttribute('aria-label', 'Zavřít menu');
  closeBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  closeBtn.addEventListener('click', closeMenu);
  mobileMenu.appendChild(closeBtn);
  mobileMenu.inert = true;

  hamburger.addEventListener('click', function() {
    const open = mobileMenu.classList.toggle('open');
    hamburger.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', open);
    mobileMenu.setAttribute('aria-hidden', !open);
    mobileMenu.inert = !open;
    document.body.style.overflow = open ? 'hidden' : '';
  });

  // Klik na odkaz v menu (i na kotvu na stejné stránce) menu zavře
  mobileMenu.addEventListener('click', function(e) {
    if (e.target.closest('a')) closeMenu();
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && mobileMenu.classList.contains('open')) closeMenu();
  });
}
