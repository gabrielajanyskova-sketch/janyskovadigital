export async function onRequest() {
  const params = new URLSearchParams({
    client_id: 'Ov23liMkRl6HDs2jVf5r',
    redirect_uri: 'https://janyskovadigital.cz/api/callback',
    scope: 'repo,user',
  });
  return Response.redirect(`https://github.com/login/oauth/authorize?${params}`, 302);
}
