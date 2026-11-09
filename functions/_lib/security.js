// Lokální pojistka platí pro jeden worker isolate. Globální limit patří do WAF/bindingu.
const buckets = new Map();
const MAX_BUCKETS = 10000;
export async function rateLimited(env, request, { binding, limit, windowMs, now = Date.now() }) {
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  if (env[binding]) {
    try { return (await env[binding].limit({ key: ip })).success !== true; }
    catch { return true; } // Při výpadku ochrany neprovádět nákladnou operaci.
  }
  const key = `${binding}:${ip}`;
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.until) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [k, b] of buckets) if (now >= b.until) buckets.delete(k);
      if (buckets.size >= MAX_BUCKETS) return true;
    }
    bucket = { count: 0, until: now + windowMs };
    buckets.set(key, bucket);
  }
  return ++bucket.count > limit;
}

export class InputError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

// Limitujeme skutečně přečtené bajty, nejen podvrhnutelnou hlavičku Content-Length.
export async function requestBody(request, maxBytes) {
  if (Number(request.headers.get('content-length')) > maxBytes) throw new InputError('Požadavek je příliš velký.', 413);
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = [];
  let size = 0, timer;
  try {
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new InputError('Odesílání trvalo příliš dlouho.', 408)), 10000); });
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new InputError('Požadavek je příliš velký.', 413);
      chunks.push(value);
    }
  } catch (e) { reader.cancel().catch(() => {}); throw e; }
  finally { clearTimeout(timer); reader.releaseLock(); }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}
