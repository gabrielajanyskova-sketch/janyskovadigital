// Pouze veřejné provozní údaje. Kontakty držitele ani celé RDAP odpovědi nevracíme.
const RDAP = {
  cz: 'https://rdap.nic.cz/domain/',
  com: 'https://rdap.verisign.com/com/v1/domain/',
  net: 'https://rdap.verisign.com/net/v1/domain/',
};
const clean = value => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 180) : null;
const domainName = value => typeof value === 'string' && /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}\.?$/i.test(value) ? value.toLowerCase().replace(/\.$/, '') : null;
const suffix = (host, zone) => host === zone || host.endsWith('.' + zone);

export function registrationSummary(data, domain) {
  if (data?.objectClassName !== 'domain' || domainName(data.ldhName) !== domainName(domain)) return null;
  const registrar = (Array.isArray(data.entities) ? data.entities : []).find(e => Array.isArray(e.roles) && e.roles.includes('registrar'));
  const cards = Array.isArray(registrar?.vcardArray?.[1]) ? registrar.vcardArray[1] : [];
  const name = cards.find(v => Array.isArray(v) && v[0] === 'fn')?.[3];
  const eventDate = action => {
    const value = (Array.isArray(data.events) ? data.events : []).find(e => e.eventAction === action)?.eventDate;
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
  };
  return {
    registrar: clean(name) || clean(registrar?.handle),
    registered: eventDate('registration'),
    changed: eventDate('last changed'),
    expires: eventDate('expiration'),
  };
}

export async function readRegistration(domain, fetchImpl = fetch) {
  const base = RDAP[domain?.split('.').at(-1)];
  if (!base || !domainName(domain)) return { status: 'unsupported', registrar: null, expires: null, source: null };
  const source = base + encodeURIComponent(domain);
  const unavailable = { status: 'unavailable', registrar: null, expires: null, source };
  const failed = reason => ({ ...unavailable, reason });
  const signal = AbortSignal.timeout(4500);
  let reader;
  let stage = 'connect';
  try {
    // Připustíme jen kanonizaci stejné domény na stejném HTTPS serveru.
    // Nikdy nepřejdeme na adresu registranta ani libovolný odkaz z RDAP.
    let target = source;
    let res;
    for (let hop = 0; hop < 3; hop++) {
      res = await fetchImpl(target, { headers: { accept: 'application/rdap+json, application/json' }, redirect: 'manual', signal });
      if (![301, 302, 303, 307, 308].includes(res.status)) break;
      await res.body?.cancel();
      const location = res.headers.get('location');
      let next;
      try { next = new URL(location, target); } catch { return failed('redirect-error'); }
      const expected = new URL(source);
      if (!location || next.origin !== expected.origin || next.username || next.password || next.search || next.hash ||
          ![expected.pathname, expected.pathname + '/'].includes(next.pathname) || next.href === target || hop === 2) return failed('redirect-error');
      target = next.href;
    }
    stage = 'response';
    if (!res.ok) return failed(res.status === 429 ? 'rate-limit' : res.status === 404 ? 'not-found' : 'http-error');
    if (!res.body || !/(?:application\/rdap\+json|application\/json)/i.test(res.headers.get('content-type') || '')) return failed('invalid-response');
    stage = 'read';
    reader = res.body.getReader();
    const chunks = []; let length = 0;
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 131072) return failed('size-limit');
      chunks.push(value);
    }
    const buffer = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
    stage = 'parse';
    let data;
    try { data = JSON.parse(new TextDecoder().decode(buffer)); } catch { return failed('invalid-response'); }
    const summary = registrationSummary(data, domain);
    return summary ? { status: 'ok', ...summary, source } : failed('invalid-response');
  } catch (error) {
    // Jen bezpečné provozní údaje, bez obsahu registru a osobních kontaktů.
    console.warn('RDAP request failed', { registry: new URL(source).hostname, stage,
      errorName: ['TypeError', 'AbortError', 'TimeoutError', 'SyntaxError'].includes(error.name) ? error.name : 'Error' });
    return failed(signal.aborted || ['TimeoutError', 'AbortError'].includes(error.name) ? 'timeout' : 'network-error');
  }
  finally { if (reader) await reader.cancel().catch(() => {}); }
}

const DNS_PROVIDERS = [
  ['Cloudflare', ['ns.cloudflare.com']],
  ['WEDOS', ['wedos.net', 'wedos.eu', 'wedos.cz', 'wedos.com']],
  ['FORPSI', ['forpsi.net', 'forpsi.cz', 'forpsi.it']],
  ['ACTIVE 24', ['active24.cz', 'active24.com', 'active24.net']],
  ['Websupport', ['websupport.cz', 'websupport.sk']],
  ['Český hosting', ['thinline.cz']],
];
const MAIL_PROVIDERS = [
  ['Google', ['aspmx.l.google.com', 'alt1.aspmx.l.google.com', 'alt2.aspmx.l.google.com', 'alt3.aspmx.l.google.com', 'alt4.aspmx.l.google.com', 'smtp.google.com']],
  ['Microsoft 365', ['mail.protection.outlook.com']],
  ['Seznam Email Profi', ['mx1.emailprofi.seznam.cz', 'mx2.emailprofi.seznam.cz']],
  ['Seznam', ['mx.seznam.cz', 'mx1.seznam.cz', 'mx2.seznam.cz', 'mx3.seznam.cz']],
  ['WEDOS', ['wedos.net']],
  ['FORPSI', ['forpsi.com']],
  ['Websupport', ['websupport.cz', 'websupport.sk']],
];
export function providerSummary(domain, dns, registration, headers = {}) {
  const hosts = values => [...new Set((values || []).map(domainName).filter(Boolean))].slice(0, 10);
  const nameservers = hosts(dns?.nameservers);
  const mailservers = hosts(dns?.mailservers);
  const identify = (list, rules) => rules.filter(([, zones]) => list.some(host => zones.some(zone => suffix(host, zone)))).map(([label]) => label);
  const delivery = [];
  if (/\bcloudflare\b/i.test(headers.server || '') || headers['cf-ray']) delivery.push('Cloudflare (proxy / CDN; skutečný hosting nemusí být vidět)');
  if (headers['x-vercel-id']) delivery.push('Vercel (podle HTTP hlavičky)');
  if (headers['x-nf-request-id']) delivery.push('Netlify (podle HTTP hlavičky)');
  return {
    domain, registration, nameservers, mailservers,
    dnsProviders: identify(nameservers, DNS_PROVIDERS),
    mailProviders: identify(mailservers, MAIL_PROVIDERS),
    delivery,
    dnsSource: domain ? `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=NS` : null,
    mailSource: domain ? `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX` : null,
  };
}
