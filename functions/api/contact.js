import { rateLimited, requestBody, InputError } from '../_lib/security.js';

// Odeslání formulářů (kontakt a barter) přes Resend na můj e-mail.
// API klíč je v proměnné prostředí RESEND_API_KEY (Cloudflare Pages → Settings → Variables and Secrets).

const TO = 'info@janyskovadigital.cz';
const FROM = 'Web Janyskova Digital <web@janyskovadigital.cz>';
const THANKS = '/podekovani';
const TURNSTILE_HOSTS = new Set(['janyskovadigital.cz', 'www.janyskovadigital.cz', 'testwebu.janyskovadigital.cz']);

// Pole, která formuláře posílají, s popisky do e-mailu
const FIELDS = {
  jmeno: 'Jméno',
  email: 'E-mail',
  web: 'Web',
  misto: 'Místo',
  message: 'Zpráva',
  zprava: 'Zpráva',
  vysledek: 'Výsledek testu webu',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

const escape = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function onRequestPost({ request, env }) {
  // Bez JS se formulář odešle klasicky — pak místo JSON přesměrujeme
  const wantsJson = (request.headers.get('Accept') || '').includes('application/json');
  const done = (ok, message) => wantsJson
    ? json({ success: ok, message }, ok ? 200 : 400)
    : ok ? Response.redirect(new URL(THANKS, request.url), 303) : new Response(message, { status: 400 });

  if (await rateLimited(env, request, { binding: 'CONTACT_LIMITER', limit: 3, windowMs: 600000 })) {
    return wantsJson ? json({ success: false, message: 'Příliš mnoho zpráv. Zkuste to za 10 minut.' }, 429)
      : new Response('Příliš mnoho zpráv. Zkuste to za 10 minut.', { status: 429, headers: { 'Retry-After': '600' } });
  }

  let form;
  try {
    form = await new Response(await requestBody(request, 65536), { headers: { 'Content-Type': request.headers.get('Content-Type') || '' } }).formData();
  } catch (e) {
    if (e instanceof InputError) return wantsJson ? json({ success: false, message: e.message }, e.status) : new Response(e.message, { status: e.status });
    return done(false, 'Neplatný formulář');
  }

  // Past na roboty: vyplněné skryté pole předstírá úspěch, ale nic se neodešle
  if (form.get('botcheck')) return done(true);

  const data = {};
  for (const key of Object.keys(FIELDS)) {
    const value = String(form.get(key) || '').trim().slice(0, 5000);
    if (value) data[key] = value;
  }

  const message = data.message || data.zprava;
  if (!data.jmeno || !data.email || !message) return done(false, 'Vyplňte prosím všechna pole.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.email.length > 254) return done(false, 'Neplatný e-mail.');

  // Token je jednorázový a ověřuje se výhradně na serveru, před odesláním e-mailu.
  const token = form.get('cf-turnstile-response');
  if (typeof token !== 'string' || !token || token.length > 2048) {
    return done(false, 'Dokončete prosím ověření proti spamu a odešlete formulář znovu.');
  }
  if (!env.TURNSTILE_SECRET_KEY) {
    return wantsJson ? json({ success: false, message: 'Ověření je dočasně nedostupné.' }, 503)
      : new Response('Ověření je dočasně nedostupné. Napište na info@janyskovadigital.cz.', { status: 503 });
  }
  let verification;
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Verification unavailable');
    verification = await response.json();
  } catch {
    return wantsJson ? json({ success: false, message: 'Ověření je dočasně nedostupné. Zkuste to znovu.' }, 503)
      : new Response('Ověření je dočasně nedostupné. Zkuste to znovu.', { status: 503 });
  }
  if (verification?.success !== true || verification.action !== 'contact' || !TURNSTILE_HOSTS.has(verification.hostname)) {
    return done(false, 'Ověření proti spamu selhalo nebo vypršelo. Obnovte ověření a zkuste to znovu.');
  }

  const subject = String(form.get('subject') || 'Nová zpráva z webu').replace(/[\r\n]+/g, ' ').slice(0, 150);

  const rows = Object.entries(data).map(([key, value]) =>
    `<tr><th align="left" valign="top" style="padding:4px 12px 4px 0">${FIELDS[key]}</th><td style="padding:4px 0;white-space:pre-wrap">${escape(value)}</td></tr>`);
  const text = Object.entries(data).map(([key, value]) => `${FIELDS[key]}: ${value}`).join('\n\n');

  let res;
  try { res = await fetch('https://api.resend.com/emails', {
    signal: AbortSignal.timeout(10000),
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [TO],
      reply_to: data.email,
      subject,
      html: `<table style="font-family:sans-serif;font-size:15px">${rows.join('')}</table>`,
      text,
    }),
  });

  } catch {
    return wantsJson ? json({ success: false, message: 'Zprávu se nepodařilo odeslat. Zkuste to znovu.' }, 502) : new Response('Chyba odesílání.', { status: 502 });
  }
  if (!res.ok) {
    console.error('Resend chyba', res.status);
    return wantsJson ? json({ success: false, message: 'Chyba serveru' }, 502) : new Response('Chyba serveru', { status: 502 });
  }
  return done(true);
}
