// Ukazatel průběhu čtení nahoře na stránce

const bar = document.createElement('div');
bar.className = 'scroll-progress';
document.body.prepend(bar);

window.addEventListener('scroll', function() {
  const s = document.documentElement;
  bar.style.width = (s.scrollTop / (s.scrollHeight - s.clientHeight) * 100) + '%';
}, { passive: true });
