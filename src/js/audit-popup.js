import { openModal, modalIsOpen } from './modal.js';
const KEY = 'audit_popup_seen';
const popup = document.getElementById('audit-popup');
let seen = false;
try { seen = sessionStorage.getItem(KEY) === '1'; } catch { /* uložiště není podmínka funkčnosti */ }
// Na dotykových a malých obrazovkách automatický interstitial nezobrazujeme.
const desktop = matchMedia('(min-width: 769px) and (hover: hover)');
if (popup && !seen && desktop.matches) {
  let shown = false, release;
  const closeBtn = document.getElementById('audit-close');
  function hide() { release?.(); release = null; popup.style.display = 'none'; }
  function show() {
    if (shown || modalIsOpen() || !desktop.matches) return;
    shown = true; popup.style.display = 'flex';
    try { sessionStorage.setItem(KEY, '1'); } catch { /* jednou za aktuální načtení */ }
    release = openModal(popup, { initialFocus: closeBtn, onEscape: hide });
  }
  desktop.addEventListener('change', event => { if (!event.matches) hide(); });
  closeBtn?.addEventListener('click', hide);
  popup.addEventListener('click', event => { if (event.target === popup || event.target.closest('a')) hide(); });
  document.addEventListener('mouseleave', event => { if (event.clientY < 10) setTimeout(show, 300); });
  setTimeout(show, 25000);
}
