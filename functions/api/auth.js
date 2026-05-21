export async function onRequest(context) {
  const clientId = "Ov231lhLF6oRmHXEduvv"; // Tvoje Client ID z GitHubu
  const redirectUri = "https://janyskovadigital.cz/api/callback";
  
  return Response.redirect(
    `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo`,
    302
  );
}
