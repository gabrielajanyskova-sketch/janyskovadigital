// Postupné zobrazení sekcí při scrollu (.reveal → .visible)

document.documentElement.classList.add('js-ready');

const revealObs = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.08 });

document.querySelectorAll('.reveal').forEach(function(el) { revealObs.observe(el); });
