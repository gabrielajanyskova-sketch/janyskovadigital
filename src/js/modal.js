// Společné modální chování: inertní pozadí, uzamčení scrollu, fokus a jeho návrat.
let active = null;
export const modalIsOpen = () => active !== null;
export function openModal(container, { initialFocus, returnFocus = document.activeElement, onEscape } = {}) {
  if (active) return null;
  const saved = [];
  for (let node = container; node.parentElement; node = node.parentElement) {
    for (const sibling of node.parentElement.children) {
      if (sibling !== node && sibling instanceof HTMLElement) {
        saved.push([sibling, sibling.inert]); sibling.inert = true;
      }
    }
    if (node.parentElement === document.body) break;
  }
  const overflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  const focusable = () => [...container.querySelectorAll('a[href],button,input,textarea,select,[tabindex]')]
    .filter(e => !e.disabled && e.tabIndex >= 0 && !e.closest('[inert]') && e.getClientRects().length);
  function keydown(event) {
    if (event.key === 'Escape') { event.preventDefault(); onEscape?.(); return; }
    if (event.key !== 'Tab') return;
    const targets = focusable(), first = targets[0], last = targets[targets.length - 1];
    if (!first) { event.preventDefault(); container.focus(); return; }
    if (!container.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
      event.preventDefault(); (event.shiftKey ? last : first).focus();
    } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  active = container;
  document.addEventListener('keydown', keydown, true);
  (initialFocus || focusable()[0] || container).focus();
  return () => {
    document.removeEventListener('keydown', keydown, true);
    for (const [node, inert] of saved) node.inert = inert;
    document.body.style.overflow = overflow; active = null;
    if (returnFocus?.isConnected && !returnFocus.closest('[inert]')) returnFocus.focus({ preventScroll: true });
  };
}
