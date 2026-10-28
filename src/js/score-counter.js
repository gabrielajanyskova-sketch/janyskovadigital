// Animované počítadlo PageSpeed skóre

setTimeout(function() {
  document.querySelectorAll('.score-num').forEach(function(el) {
    const target = parseInt(el.dataset.target, 10);
    const start  = performance.now();
    requestAnimationFrame(function tick(now) {
      const p = Math.min((now - start) / 1400, 1);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(e * target);
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = target;
    });
  });
}, 600);
