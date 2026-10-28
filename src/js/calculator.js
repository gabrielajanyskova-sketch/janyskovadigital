// Kalkulačka úspor (WordPress vs. web v čistém kódu)

const hostingEl = document.getElementById('k-hosting');

if (hostingEl) {
  const $ = id => document.getElementById(id);
  const fmt = n => Math.round(n).toLocaleString('cs-CZ') + '\u00a0Kč';

  function calc() {
    const h = +hostingEl.value;
    const s = +$('k-sprava').value;
    const d = +$('k-domena').value;
    const r = +$('k-roky').value;

    $('k-hosting-out').textContent = fmt(h);
    $('k-sprava-out').textContent  = fmt(s);
    $('k-domena-out').textContent  = fmt(d);
    $('k-roky-out').textContent    = r + (r === 1 ? ' rok' : r < 5 ? ' roky' : ' let');

    const ted    = (h + s + d) * r;
    const jd     = 5900 + d * r;
    const uspora = Math.max(0, ted - jd);
    const max    = Math.max(ted, jd, 1);

    $('k-ted').textContent     = fmt(ted);
    $('k-jd').textContent      = fmt(jd);
    $('k-uspora').textContent  = fmt(uspora);
    $('k-bar-ted').style.width = Math.round(ted / max * 100) + '%';
    $('k-bar-jd').style.width  = Math.round(jd  / max * 100) + '%';
  }

  ['k-hosting', 'k-sprava', 'k-domena', 'k-roky'].forEach(function(id) {
    $(id).addEventListener('input', calc);
  });
  calc();
}
