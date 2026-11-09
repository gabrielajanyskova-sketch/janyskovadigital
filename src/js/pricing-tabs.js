for (const group of new Set([...document.querySelectorAll('[data-tab-group]')].map(b => b.dataset.tabGroup))) {
  const buttons = [...document.querySelectorAll(`[data-tab-group="${group}"]`)];
  function select(button, focus = false) {
    for (const b of buttons) {
      const active = b === button, panel = document.getElementById(`${group}-${b.dataset.tab}`);
      b.classList.toggle('active', active); b.setAttribute('aria-selected', String(active)); b.tabIndex = active ? 0 : -1;
      if (panel) panel.hidden = !active;
    }
    if (focus) button.focus();
  }
  buttons.forEach((button, i) => {
    const panel = document.getElementById(`${group}-${button.dataset.tab}`);
    button.id ||= `${group}-tab-${i}`; button.setAttribute('aria-controls', panel.id);
    panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', button.id);
    button.addEventListener('click', () => select(button));
    button.addEventListener('keydown', event => {
      const next = { ArrowRight: (i + 1) % buttons.length, ArrowLeft: (i + buttons.length - 1) % buttons.length, Home: 0, End: buttons.length - 1 }[event.key];
      if (next !== undefined) { event.preventDefault(); select(buttons[next], true); }
    });
  });
  select(buttons.find(b => b.getAttribute('aria-selected') === 'true') || buttons[0]);
}
