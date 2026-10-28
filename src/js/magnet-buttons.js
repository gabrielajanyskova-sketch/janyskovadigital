// Hlavní tlačítka se lehce „přitahují“ ke kurzoru (jen na zařízeních s myší)

if (!window.matchMedia('(hover: none)').matches) {
  document.querySelectorAll('.btn-primary').forEach(function(btn) {
    btn.addEventListener('mousemove', function(e) {
      const rect = btn.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width  / 2) * 0.22;
      const y = (e.clientY - rect.top  - rect.height / 2) * 0.22;
      btn.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    });
    btn.addEventListener('mouseleave', function() {
      btn.style.transform = '';
    });
  });
}
