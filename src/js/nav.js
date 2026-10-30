import { openModal } from './modal.js';
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobile-menu');
let release;
export function closeMenu() {
  if (!mobileMenu || !hamburger) return;
  release?.(); release = null;
  mobileMenu.classList.remove('open'); hamburger.classList.remove('open');
  hamburger.setAttribute('aria-expanded', 'false'); mobileMenu.setAttribute('aria-hidden', 'true'); mobileMenu.inert = true;
}
if (hamburger && mobileMenu) {
  const closeBtn = document.createElement('button'); closeBtn.className = 'menu-close'; closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Zavřít menu'); closeBtn.textContent = '×';
  closeBtn.addEventListener('click', closeMenu); mobileMenu.appendChild(closeBtn); mobileMenu.inert = true;
  mobileMenu.setAttribute('aria-modal', 'true');
  hamburger.addEventListener('click', () => {
    if (release) return closeMenu();
    mobileMenu.inert = false; mobileMenu.classList.add('open'); hamburger.classList.add('open');
    hamburger.setAttribute('aria-expanded', 'true'); mobileMenu.setAttribute('aria-hidden', 'false');
    release = openModal(mobileMenu, { initialFocus: closeBtn, returnFocus: hamburger, onEscape: closeMenu });
    if (!release) closeMenu();
  });
  mobileMenu.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  window.matchMedia('(min-width: 769px)').addEventListener('change', event => { if (event.matches) closeMenu(); });
}
