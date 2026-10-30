// Pouze veřejný klíč; tajný TURNSTILE_SECRET_KEY nikdy neopouští server.
const SITE_KEY = '0x4AAAAAAFsO2XWvTMVxMmsT';

export function onRequestGet({ request, env }) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
  };
  if (request.headers.get('Origin') === 'https://testwebu.janyskovadigital.cz') {
    headers['Access-Control-Allow-Origin'] = 'https://testwebu.janyskovadigital.cz';
  }
  const sitekey = env.TURNSTILE_SITE_KEY || SITE_KEY;
  const ready = Boolean(env.TURNSTILE_SECRET_KEY);
  return new Response(JSON.stringify(ready ? { sitekey } : { error: 'Ověření je dočasně nedostupné.' }), {
    status: ready ? 200 : 503, headers,
  });
}
