// Začátek přihlášení do CMS (Decap) přes GitHub OAuth.
// Náhodný `state` se uloží do cookie a callback ho ověří (ochrana proti podvrženému přihlášení).

const CLIENT_ID = 'Ov23liMkRl6HDs2jVf5r';

export async function onRequest({ request }) {
  const origin = new URL(request.url).origin;
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: `${origin}/api/callback`,
    // Repozitář je veřejný: stačí zápis do veřejných repozitářů a čtení profilu
    scope: 'public_repo,read:user',
    state,
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://github.com/login/oauth/authorize?${params}`,
      'Set-Cookie': `oauth_state=${state}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      'Cache-Control': 'no-store',
    },
  });
}
