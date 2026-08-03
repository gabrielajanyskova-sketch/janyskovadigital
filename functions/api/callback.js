export async function onRequest({ request, env }) {
  const code = new URL(request.url).searchParams.get('code');
  if (!code) return new Response('Chybí kód', { status: 400 });

  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: 'Ov23liMkRl6HDs2jVf5r',
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const data = await res.json();
  if (data.error) return new Response(`OAuth chyba: ${data.error_description}`, { status: 400 });

  const token = JSON.stringify(data.access_token);
  const html = `<!DOCTYPE html><html><body><script>
(function(){
  function cb(e){
    window.opener.postMessage(
      'authorization:github:success:'+JSON.stringify({token:${token},provider:'github'}),
      e.origin
    );
  }
  window.addEventListener('message',cb,false);
  window.opener.postMessage('authorizing:github','*');
})();
<\/script></body></html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
}
