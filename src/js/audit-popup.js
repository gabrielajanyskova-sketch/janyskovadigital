// Popup s nabídkou auditu — při odjezdu myši z okna, na mobilu po dočtení většiny stránky

const KEY   = 'audit_popup_seen';
const popup = document.getElementById('audit-popup');

if (popup && !sessionStorage.getItem(KEY)) {
  const closeBtn = document.getElementById('audit-close');
  const ctaBtn   = document.getElementById('audit-cta');
  let shown = false;
  let lastFocus = null;

  function show() {
    if (shown || sessionStorage.getItem(KEY)) return;
    shown = true;
    lastFocus = document.activeElement;
    popup.style.display = 'flex';
    sessionStorage.setItem(KEY, '1');
    if (closeBtn) closeBtn.focus();
  }

  function hide() {
    if (popup.style.display === 'none') return;
    popup.style.display = 'none';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  if (closeBtn) closeBtn.addEventListener('click', hide);
  if (ctaBtn)   ctaBtn.addEventListener('click', hide);
  popup.addEventListener('click', function(e) { if (e.target === popup) hide(); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') hide(); });

  let exitFired = false;
  document.addEventListener('mouseleave', function(e) {
    if (e.clientY < 10 && !exitFired) { exitFired = true; setTimeout(show, 300); }
  });
  // Na mobilu žádný časovač (rušivý interstitial) — popup až když návštěvník dočte víc než polovinu stránky
  if (/Mobi|Android/i.test(navigator.userAgent)) {
    window.addEventListener('scroll', function onScroll() {
      const depth = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      if (depth > 0.6) { window.removeEventListener('scroll', onScroll); show(); }
    }, { passive: true });
  } else {
    setTimeout(show, 25000);
  }
}
