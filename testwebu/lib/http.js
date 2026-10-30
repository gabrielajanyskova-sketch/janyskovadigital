// Bezpečné stahování cizích webů: jen http(s), jen veřejné adresy, časový limit a limit velikosti.
// Aplikace stahuje stránky, které zadá kdokoli z internetu — bez těchto pojistek by šla zneužít
// k útokům na interní služby (SSRF) nebo k zahlcení serveru obřími soubory.

export const USER_AGENT = 'Mozilla/5.0 (compatible; TestWebuBot/1.0; +https://testwebu.janyskovadigital.cz)';
const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 12000;
const MAX_REDIRECTS = 6;

export class AuditError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

// Normalizuje vstup od uživatele („seznam.cz“ → „https://seznam.cz/“) a odmítne nebezpečné adresy.
export function normalizeUrl(input) {
  let value = String(input || '').trim();
  if (!value) throw new AuditError('Zadejte adresu webu.');
  if (value.length > 2000) throw new AuditError('Adresa je příliš dlouhá.');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = 'https://' + value;
  let url;
  try { url = new URL(value); } catch { throw new AuditError('Tohle nevypadá jako adresa webu.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new AuditError('Podporované jsou jen adresy http a https.');
  if (url.username || url.password) throw new AuditError('Adresa nesmí obsahovat přihlašovací údaje.');
  if (url.port && !['80', '443'].includes(url.port)) throw new AuditError('Adresa s nestandardním portem není podporovaná.');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  url.hostname = host;
  if (!host.includes('.') || isBlockedHost(host)) throw new AuditError('Tuto adresu nelze otestovat. Zadejte veřejný web.');
  url.hash = '';
  return url;
}

function isBlockedHost(host) {
  if (/^(localhost|.*\.(localhost|local|internal|lan|home|corp|intranet))$/.test(host)) return true;
  if (/^\[.*\]$/.test(host) || host.includes(':')) return true;            // IPv6 literály nepovolujeme vůbec
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return isPrivateIPv4(host);
  return false;
}

export function isPrivateIPv4(ip) {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)) return true;
  const parts = ip.split('.').map(Number);
  if (parts.some(n => n > 255)) return true;
  const [a, b, c] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113);
}

export function isPrivateIPv6(ip) {
  // Přijímáme pouze globální unicast 2000::/3; ostatní a neplatné tvary odmítáme.
  let host;
  try { host = new URL(`http://[${ip}]/`).hostname.slice(1, -1).toLowerCase(); }
  catch { return true; }
  if (!/^[23]/.test(host)) return true; // zahrnuje i všechny IPv4-mapped adresy
  return /^2001:(?:db8|0|10|2[0-9a-f]):/.test(host) || host.startsWith('2001::') || host.startsWith('2002:');
}

// Ověří přes DNS-over-HTTPS, že doména míří na veřejné IP (IPv4 i IPv6) — ochrana proti doméně namířené dovnitř sítě.
export async function assertPublicHost(host, fetchImpl) {
  normalizeUrl(`https://${host}/`);
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return;
  const lookup = type => fetchImpl(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, {
    headers: { accept: 'application/dns-json' },
    signal: AbortSignal.timeout(5000),
  }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  const [v4, v6] = await Promise.all([lookup('A'), lookup('AAAA')]);
  if (!v4 || !v6 || ![0, 3].includes(v4.Status) || ![0, 3].includes(v6.Status)) throw new AuditError('DNS domény se nepodařilo bezpečně ověřit.', 422);                                                 // DNS nedostupné: rozhodne až samotné stažení
  if (v4?.Status === 3) throw new AuditError('Doména neexistuje. Zkontrolujte adresu.');
  const answers = [...(v4?.Answer || []), ...(v6?.Answer || [])];
  if (!answers.some(r => r.type === 1 || r.type === 28)) throw new AuditError('Doména nemá ověřitelnou veřejnou adresu.', 422);
  if (answers.some(r => (r.type === 1 && isPrivateIPv4(r.data)) || (r.type === 28 && isPrivateIPv6(r.data)))) {
    throw new AuditError('Tuto adresu nelze otestovat. Zadejte veřejný web.');
  }
}

// Stáhne URL a ručně projde přesměrování (každý krok znovu ověří). Vrací řetěz přesměrování,
// konečnou odpověď, hlavičky a tělo (oříznuté na MAX_BYTES).
export async function fetchPage(url, { fetchImpl, method = 'GET', checkHost = true, checkedHosts = new Set() } = {}) {
  const chain = [];
  let current = new URL(url);
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    if (checkHost) {
      try { normalizeUrl(current.href); } catch { return { ok: false, error: 'blocked', url: current.href, chain }; }
      if (!checkedHosts.has(current.hostname)) {
        try { await assertPublicHost(current.hostname, fetchImpl); } catch { return { ok: false, error: 'blocked', url: current.href, chain }; }
        checkedHosts.add(current.hostname);
      }
    }
    const started = Date.now();
    let res;
    try {
      res = await fetchImpl(current.href, {
        method,
        redirect: 'manual',
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,*/*;q=0.8', 'accept-language': 'cs,en;q=0.8' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const location = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && location) {
        res.body?.cancel().catch(() => {});
        chain.push({ url: current.href, status: res.status });
        current = new URL(location, current);
        continue;
      }
      const body = method === 'HEAD' ? '' : await readLimited(res);
      if (method === 'HEAD') res.body?.cancel().catch(() => {});
      return { ok: res.ok, status: res.status, url: current.href, chain, headers: res.headers,
        body, ms: Date.now() - started, contentType: res.headers.get('content-type') || '' };
    } catch (e) {
      return { ok: false, error: e.name === 'TimeoutError' ? 'timeout' : 'network', url: current.href, chain };
    }

  }
  return { ok: false, error: 'redirects', url: current.href, chain };
}

async function readLimited(res) {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { await reader.cancel(); break; }
    chunks.push(value);
  }
  const all = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let offset = 0;
  for (const c of chunks) { all.set(c, offset); offset += c.byteLength; }
  return new TextDecoder('utf-8', { fatal: false }).decode(all);
}
