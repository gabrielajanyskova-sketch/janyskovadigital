// Interaktivní prvky v článcích

// Tlačítko „Kopírovat“ u promptu: <button class="copy-btn" data-copy="id-prvku">
document.querySelectorAll('[data-copy]').forEach(function(btn) {
  const label = btn.textContent;
  btn.addEventListener('click', async function() {
    const source = document.getElementById(btn.dataset.copy);
    try {
      await navigator.clipboard.writeText(source.innerText.trim());
      btn.textContent = 'Zkopírováno ✓';
      btn.classList.add('copied');
    } catch {
      btn.textContent = 'Nepodařilo se';
    }
    setTimeout(function() {
      btn.textContent = label;
      btn.classList.remove('copied');
    }, 2000);
  });
});

// Zaškrtávací checklist: <div class="checker-item" role="checkbox">
document.querySelectorAll('.checker-item').forEach(function(item) {
  function toggle() {
    const checked = item.classList.toggle('checked');
    item.setAttribute('aria-checked', checked);
  }
  item.addEventListener('click', toggle);
  item.addEventListener('keydown', function(e) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); }
  });
});
