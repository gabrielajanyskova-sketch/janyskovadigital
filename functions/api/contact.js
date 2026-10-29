// Odeslání formulářů (kontakt a barter) přes Resend na můj e-mail.
// API klíč je v proměnné prostředí RESEND_API_KEY (Cloudflare Pages → Settings → Variables and Secrets).

const TO = 'info@janyskovadigital.cz';
const FROM = 'Web Janyskova Digital <web@janyskovadigital.cz>';
const THANKS = '/podekovani';

// Pole, která formuláře posílají, s popisky do e-mailu
const FIELDS = {
  jmeno: 'Jméno',
  email: 'E-mail',
  web: 'Web',
  misto: 'Místo',
  message: 'Zpráva',
  zprava: 'Zpráva',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

const escape = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function onRequestPost({ request, env }) {
  // Bez JS se formulář odešle klasicky — pak místo JSON přesměrujeme
  const wantsJson = (request.headers.get('Accept') || '').includes('application/json');
  const done = (ok, message) => wantsJson
    ? json({ success: ok, message }, ok ? 200 : 400)
    : ok ? Response.redirect(new URL(THANKS, request.url), 303) : new Response(message, { status: 400 });

  let form;
  try {
    form = await request.formData();
  } catch {
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

  const subject = String(form.get('subject') || 'Nová zpráva z webu').replace(/[\r\n]+/g, ' ').slice(0, 150);

  const rows = Object.entries(data).map(([key, value]) =>
    `<tr><th align="left" valign="top" style="padding:4px 12px 4px 0">${FIELDS[key]}</th><td style="padding:4px 0;white-space:pre-wrap">${escape(value)}</td></tr>`);
  const text = Object.entries(data).map(([key, value]) => `${FIELDS[key]}: ${value}`).join('\n\n');

  const res = await fetch('https://api.resend.com/emails', {
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

  if (!res.ok) {
    console.error('Resend chyba', res.status, await res.text());
    return wantsJson ? json({ success: false, message: 'Chyba serveru' }, 502) : new Response('Chyba serveru', { status: 502 });
  }
  return done(true);
}
