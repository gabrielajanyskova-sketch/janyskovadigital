// Přepínače variant v ceníku (Web Care, Web Refresh)
//   <button data-tab-group="care" data-tab="basic"> přepne na panel id="care-basic"

document.querySelectorAll('[data-tab-group]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    const group = btn.dataset.tabGroup;
    document.querySelectorAll('[data-tab-group="' + group + '"]').forEach(function(b) {
      const active = b === btn;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', active);
      document.getElementById(group + '-' + b.dataset.tab).hidden = !active;
    });
  });
});
