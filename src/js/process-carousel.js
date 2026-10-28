// Karusel „Jak to probíhá“ — automaticky střídá kroky, tečky a klik na kartu přepínají ručně

const cards = document.querySelectorAll('.process-focus-card');
const dots  = document.querySelectorAll('.process-dot');

if (cards.length) {
  let current = 0;
  let timer;

  function setStep(n) {
    cards[current].classList.remove('active');
    dots[current].classList.remove('active');
    current = n;
    cards[current].classList.add('active');
    dots[current].classList.add('active');
    clearInterval(timer);
    timer = setInterval(advance, 3200);
  }

  function advance() { setStep((current + 1) % cards.length); }

  cards.forEach(function(card, i) {
    card.addEventListener('click', function() { if (i !== current) setStep(i); });
  });
  dots.forEach(function(dot, i) {
    dot.addEventListener('click', function() { setStep(i); });
  });

  timer = setInterval(advance, 3200);
}
