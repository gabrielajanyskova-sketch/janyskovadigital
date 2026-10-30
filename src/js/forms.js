import { resetTurnstile } from './turnstile.js';

// Odesílání formulářů přes vlastní endpoint /api/contact (Resend) — kontaktní formulář a barter

const ENDPOINT = '/api/contact';
const THANKS   = '/podekovani';

async function submit(form) {
  const res  = await fetch(ENDPOINT, { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(form) });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Chyba serveru');
  window.location.href = THANKS;
}

const contactForm = document.getElementById('contact-form');

if (contactForm) {
  const submitBtn = contactForm.querySelector('button[type="submit"]');
  const origLabel = submitBtn.innerHTML;

  function showMsg(text, type) {
    const old = contactForm.querySelector('.form-msg');
    if (old) old.remove();
    const div = document.createElement('div');
    div.className = 'form-msg form-msg--' + type;
    div.setAttribute('role', type === 'error' ? 'alert' : 'status');
    div.textContent = text;
    contactForm.appendChild(div);
  }

  contactForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const jmeno  = contactForm.querySelector('#jmeno').value.trim();
    const email  = contactForm.querySelector('#email').value.trim();
    const zprava = contactForm.querySelector('#zprava').value.trim();
    if (!jmeno || !email || !zprava) { showMsg('Vyplňte prosím všechna pole.', 'error'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showMsg('Zadejte platnou e-mailovou adresu.', 'error'); return; }

    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Odesílám…';

    try {
      await submit(contactForm);
    } catch {
      resetTurnstile(contactForm);
      showMsg('Něco se pokazilo. Zkuste to znovu nebo mi napište přímo na info@janyskovadigital.cz', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = origLabel;
    }
  });
}

const barterForm = document.getElementById('barter-form');

if (barterForm) {
  const btn  = barterForm.querySelector('.barter-submit');
  const orig = btn.textContent;

  barterForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const filled = ['jmeno', 'email', 'zprava'].every(function(name) {
      return barterForm.querySelector('[name="' + name + '"]').value.trim();
    });
    if (!filled) { btn.textContent = 'Vyplňte všechna pole.'; return; }

    btn.disabled = true;
    btn.textContent = 'Odesílám…';
    try {
      await submit(barterForm);
    } catch {
      resetTurnstile(barterForm);
      btn.disabled = false;
      btn.textContent = orig;
    }
  });
}
