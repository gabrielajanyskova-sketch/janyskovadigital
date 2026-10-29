// Karusel „Jak to probíhá“ — automaticky střídá kroky, tečky a klik na kartu přepínají ručně.
// Přístupnost (WCAG 2.2.2): pozastaví se pod myší nebo při fokusu, po ručním výběru se zastaví
// natrvalo a kdo má v systému omezené animace, automatické střídání vůbec nedostane.

const cards = document.querySelectorAll('.process-focus-card');
const dots  = document.querySelectorAll('.process-dot');
const wrap  = document.getElementById('process-focus');

if (cards.length) {
  const INTERVAL = 3200;
  let current = 0;
  let timer = null;
  let stopped = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function show(n) {
    cards[current].classList.remove('active');
    dots[current].classList.remove('active');
    dots[current].removeAttribute('aria-current');
    current = n;
    cards[current].classList.add('active');
    dots[current].classList.add('active');
    dots[current].setAttribute('aria-current', 'step');
  }

  function play() {
    if (stopped || timer) return;
    timer = setInterval(function() { show((current + 1) % cards.length); }, INTERVAL);
  }

  function pause() {
    clearInterval(timer);
    timer = null;
  }

  function choose(n) {
    stopped = true;
    pause();
    show(n);
  }

  cards.forEach(function(card, i) {
    card.addEventListener('click', function() { if (i !== current) choose(i); });
  });
  dots.forEach(function(dot, i) {
    dot.addEventListener('click', function() { choose(i); });
  });

  if (wrap) {
    wrap.addEventListener('mouseenter', pause);
    wrap.addEventListener('mouseleave', play);
    wrap.addEventListener('focusin', pause);
    wrap.addEventListener('focusout', play);
  }

  dots[current].setAttribute('aria-current', 'step');
  play();
}
