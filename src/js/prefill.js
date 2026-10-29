// Příchod z testu webu (testwebu.janyskovadigital.cz): ?web=… předvyplní adresu webu v poptávce

const field = document.getElementById('web');
const web = new URLSearchParams(location.search).get('web');

if (field && web && /^https?:\/\/[^\s<>"]{3,200}$/.test(web) && !field.value) {
  field.value = web;
}
