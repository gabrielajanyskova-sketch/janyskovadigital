// Přepínač světlého a tmavého vzhledu (tlačítko v hlavičce a v mobilním menu)

const sunSvg  = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
const moonSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

let theme = localStorage.getItem('jd-theme') || 'dark';
document.documentElement.setAttribute('data-theme', theme);

function makeBtn() {
  const b = document.createElement('button');
  b.className = 'theme-toggle';
  b.setAttribute('aria-label', 'Přepnout světlé/tmavé téma');
  b.innerHTML = theme === 'dark' ? sunSvg : moonSvg;
  b.addEventListener('click', function() {
    theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('jd-theme', theme);
    document.querySelectorAll('.theme-toggle').forEach(function(tb) {
      tb.innerHTML = theme === 'dark' ? sunSvg : moonSvg;
    });
  });
  return b;
}

const hamburgerBtn = document.getElementById('hamburger');
if (hamburgerBtn) hamburgerBtn.parentNode.insertBefore(makeBtn(), hamburgerBtn);

const fullMenu = document.getElementById('mobile-menu');
if (fullMenu) {
  const mb = makeBtn();
  mb.classList.add('theme-toggle--menu');
  fullMenu.appendChild(mb);
}
