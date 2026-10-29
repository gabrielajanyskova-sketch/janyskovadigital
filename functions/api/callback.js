// Dokončení přihlášení do CMS: vymění kód za token a předá ho oknu /admin.
// Token se posílá jen stránce ze stejné domény — nikdy cizímu webu, který by okno otevřel.

const CLIENT_ID = 'Ov23liMkRl6HDs2jVf5r';

const text = (body, status) => new Response(body, {
  status,
  headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
});

function cookie(request, name) {
  const match = (request.headers.get('Cookie') || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code) return text('Chybí kód', 400);
  if (!state || state !== cookie(request, 'oauth_state')) return text('Neplatný nebo prošlý požadavek na přihlášení. Zkuste to znovu.', 403);

  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code }),
  });

  const data = await res.json();
  if (data.error || !data.access_token) return text(`OAuth chyba: ${data.error_description || data.error || 'bez tokenu'}`, 400);

  const origin = JSON.stringify(url.origin);
  const message = JSON.stringify('authorization:github:success:' + JSON.stringify({ token: data.access_token, provider: 'github' }));
  const html = `<!DOCTYPE html><html><body><script>
(function(){
  var origin=${origin};
  window.addEventListener('message',function(e){
    if(e.origin!==origin||e.source!==window.opener)return;
    window.opener.postMessage(${message},origin);
  });
  window.opener.postMessage('authorizing:github',origin);
})();
<\/script></body></html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': 'oauth_state=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
    },
  });
}
