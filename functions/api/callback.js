export async function onRequest(context) {
  const { searchParams } = new URL(context.request.url);
  const code = searchParams.get('code');
  
  const clientId = "Ov231lhLF6oRmHXEduvv";
  // SEM VLOŽ TEN DLOUHÝ CLIENT SECRET, KTERÝ JSI VYGENEROVALA NA GITHUBU V MINULÉM KROKU:
  const clientSecret = "3ec35317161932f70182c300c3ac69ab38105377"; 

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
    }),
  });

  const data = await response.json();

  if (data.error) {
    return new Response(`Chyba přihlášení: ${data.error_description}`, { status: 400 });
  }

  // Předání klíče zpět do Decap CMS v admin panelu
  const html = `
    <!DOCTYPE html>
    <html lang="cs">
    <head><title>Autorizace...</title></head>
    <body>
      <script>
        const token = "${data.access_token}";
        window.opener.postMessage("authorizing:github", "*");
        window.opener.postMessage(\`authorization:github:success:\${JSON.stringify({ token: token, provider: "github" })}\`, "*");
        window.close();
      </script>
    </body>
    </html>
  `;

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
