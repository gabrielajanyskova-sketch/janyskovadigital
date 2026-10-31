import { resetTurnstile } from './turnstile.js';
import { withTimeout } from './request-timeout.js';

// Odesílání formulářů přes vlastní endpoint /api/contact (Resend) — kontaktní formulář a barter

const ENDPOINT = '/api/contact';
const THANKS   = '/podekovani';

async function submit(form) {
  const { res, data } = await withTimeout(20000, async signal => {
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(form), signal });
    const data = await res.json().catch(() => null);
    return { res, data };
  });
  if (!res.ok || data?.success !== true) throw new Error(data?.message || (res.status === 429 ? 'Příliš mnoho zpráv. Zkuste to za 10 minut.' : 'Odeslání se nepodařilo potvrdit. Zkuste to později nebo napište na info@janyskovadigital.cz.'));
  window.location.href = THANKS;
}

function showMsg(form, text) {
  form.querySelector('.form-msg')?.remove();
  const div = document.createElement('div');
  div.className = 'form-msg form-msg--error';
  div.setAttribute('role', 'alert');
  div.textContent = text;
  form.appendChild(div);
}

function errorMessage(error) {
  if (error.name === 'TimeoutError') return 'Server neodpověděl včas, odeslání se nepodařilo potvrdit. Napište mi prosím na info@janyskovadigital.cz.';
  return error.message === 'Failed to fetch' || error instanceof TypeError
    ? 'Nepodařilo se spojit se serverem. Zkontrolujte připojení nebo napište na info@janyskovadigital.cz.'
    : error.message;
}

const contactForm = document.getElementById('contact-form');

if (contactForm) {
  const submitBtn = contactForm.querySelector('button[type="submit"]');
  const origLabel = submitBtn.innerHTML;

  contactForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const jmeno  = contactForm.querySelector('#jmeno').value.trim();
    const email  = contactForm.querySelector('#email').value.trim();
    const zprava = contactForm.querySelector('#zprava').value.trim();
    if (!jmeno || !email || !zprava) { showMsg(contactForm, 'Vyplňte prosím všechna pole.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showMsg(contactForm, 'Zadejte platnou e-mailovou adresu.'); return; }

    contactForm.querySelector('.form-msg')?.remove();
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Odesílám…';

    try {
      await submit(contactForm);
    } catch (error) {
      resetTurnstile(contactForm);
      showMsg(contactForm, errorMessage(error));
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
    if (!filled) { showMsg(barterForm, 'Vyplňte prosím všechna pole.'); return; }

    barterForm.querySelector('.form-msg')?.remove();
    btn.disabled = true;
    btn.textContent = 'Odesílám…';
    try {
      await submit(barterForm);
    } catch (error) {
      resetTurnstile(barterForm);
      showMsg(barterForm, errorMessage(error));
      btn.disabled = false;
      btn.textContent = orig;
    }
  });
}
