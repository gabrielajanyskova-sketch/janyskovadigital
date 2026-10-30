// Sdílené pro kontakt, barter i formulář na subdoméně testwebu.
let scriptPromise;
function loadScript() {
  return scriptPromise ||= new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile unavailable'));
    script.onerror = reject;
    document.head.append(script);
  });
}

export function resetTurnstile(form) {
  if (form.dataset.turnstileId && window.turnstile) window.turnstile.reset(form.dataset.turnstileId);
}

for (const form of document.querySelectorAll('form[data-turnstile]')) {
  const container = document.createElement('div');
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = 'Načítám ochranu proti spamu…';
  const button = form.querySelector('button[type="submit"]');
  button.before(container, status);
  const unavailable = () => { status.textContent = 'Ověření proti spamu se nepodařilo načíst. Obnovte stránku nebo napište na info@janyskovadigital.cz.'; };

  form.addEventListener('submit', event => {
    if (!new FormData(form).get('cf-turnstile-response')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      status.textContent = 'Před odesláním prosím dokončete ověření proti spamu. Pokud se nezobrazuje, obnovte stránku nebo napište na info@janyskovadigital.cz.';
    }
  }, true);

  const configUrl = new URL('/api/turnstile', form.action);
  Promise.all([
    loadScript(),
    fetch(configUrl, { credentials: 'omit', signal: AbortSignal.timeout(10000) }).then(async response => {
      if (!response.ok) throw new Error('Configuration unavailable');
      const data = await response.json();
      if (!data.sitekey) throw new Error('Site key missing');
      return data.sitekey;
    }),
  ]).then(([turnstile, sitekey]) => {
    form.dataset.turnstileId = turnstile.render(container, {
      sitekey, action: 'contact', language: 'cs', theme: 'auto', size: 'flexible',
      callback: () => { status.textContent = 'Ověření dokončeno.'; },
      'expired-callback': () => { status.textContent = 'Platnost ověření vypršela. Počkejte prosím na nové ověření.'; },
      'error-callback': () => { unavailable(); },
    });
    status.textContent = 'Před odesláním dokončete ověření proti spamu.';
  }).catch(unavailable);
}
