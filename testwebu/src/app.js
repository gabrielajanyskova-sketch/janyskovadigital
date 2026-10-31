import '../../src/js/turnstile.js';

// Stránka testu webu: spustí audit a dvě měření rychlosti souběžně a průběžně vykresluje výsledky.
// Data z testovaného webu se vkládají jen jako text (textContent), nikdy jako HTML.

import { CATEGORIES, CATEGORY_QUESTIONS, score } from '../lib/checks.js';
import { normalizeUrl } from '../lib/http.js';
import { checkStatusLabel, explanationCopy } from './check-copy.js';

const $ = id => document.getElementById(id);
const form = $('audit-form');
const input = $('url');
const STATUS_ORDER = { fail: 0, warn: 1, pass: 2, info: 3 };

let state = null;
let controller = null;

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}

function showError(message) {
  $('form-error').textContent = message;
  $('form-error').hidden = false;
}

function setStep(name, status) {
  const li = document.querySelector(`[data-step="${name}"]`);
  li.classList.remove('running', 'done', 'failed');
  li.classList.add(status);
}

async function getJson(url, options, signal) {
  const res = await fetch(url, { ...options, signal });
  const data = await res.json().catch(() => null);
  if (res.ok && data) return { ...data, cacheHit: res.headers.get('x-cache') === 'HIT' };
  if (data?.error) throw new Error(data.error);
  // Odpověď není od aplikace (chybová stránka Cloudflaru): ukázat srozumitelný důvod a kód
  const reason = res.status === 429 ? 'Příliš mnoho testů za krátkou dobu, zkuste to za minutu.'
    : res.status >= 520 ? 'Měření trvalo příliš dlouho nebo spadlo, zkuste to znovu.'
    : 'Neočekávaná odpověď serveru.';
  throw new Error(`${reason} (kód ${res.status})`);
}

async function run(url, { fresh = false } = {}) {
  controller?.abort();
  controller = new AbortController();
  const current = controller;
  const currentState = { audit: null, speed: {}, speedErrors: {} };
  const isCurrent = () => controller === current;
  $('form-error').hidden = true;
  $('results').hidden = true;
  $('progress').hidden = false;
  $('submit').disabled = true;
  $('rerun').disabled = true;
  ['audit', 'mobile', 'desktop'].forEach(s => setStep(s, 'running'));
  state = currentState;
  input.removeAttribute('aria-invalid');

  const params = new URLSearchParams(location.search);
  params.set('url', url);
  history.replaceState(null, '', `?${params}`);

  const speed = strategy => getJson(`/api/speed?url=${encodeURIComponent(url)}&strategy=${strategy}${fresh ? '&refresh=1' : ''}`, undefined, current.signal)
    .then(data => { if (!isCurrent() || current.signal.aborted) return; currentState.speed[strategy] = data; setStep(strategy, 'done'); })
    .catch(e => { if (!isCurrent() || e.name === 'AbortError') return; currentState.speedErrors[strategy] = e.message; setStep(strategy, 'failed'); })
    .finally(() => { if (isCurrent() && currentState.audit) render(); });

  // Pojistka: když server do 100 s neodpoví, ukázat srozumitelnou chybu místo nekonečného čekání
  const watchdog = setTimeout(() => {
    if (!isCurrent()) return;
    for (const strategy of ['mobile', 'desktop']) {
      if (!currentState.speed[strategy] && !currentState.speedErrors[strategy]) {
        currentState.speedErrors[strategy] = 'Google neodpověděl v časovém limitu.';
        setStep(strategy, 'failed');
      }
    }
    current.abort();
    if (currentState.audit) render();
    else setStep('audit', 'failed');
    $('progress').hidden = true;
    $('submit').disabled = false;
    $('rerun').disabled = false;
    showError(state.audit ? 'Měření rychlosti od Googlu neodpovědělo, výsledek je bez něj.' : 'Test neodpověděl do 100 sekund. Zkuste to prosím znovu za chvíli.');
  }, 100000);

  const mobile = speed('mobile');
  const desktop = speed('desktop');

  try {
    const audit = await getJson('/api/audit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, refresh: fresh }),
    }, current.signal);
    if (!isCurrent()) { clearTimeout(watchdog); return; }
    currentState.audit = audit;
    setStep('audit', 'done');
    render();
    $('results').hidden = false;
    $('result-title').focus({ preventScroll: true });
    $('results').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  } catch (e) {
    if (!isCurrent()) { clearTimeout(watchdog); return; }
    if (e.name === 'AbortError') return;
    clearTimeout(watchdog);
    controller.abort();
    $('progress').hidden = true;
    showError(e.message);
    setStep('audit', 'failed');
    input.setAttribute('aria-invalid', 'true');
    $('submit').disabled = false;
    $('rerun').disabled = false;
    return;
  }
  await Promise.allSettled([mobile, desktop]);
  clearTimeout(watchdog);
  if (!isCurrent()) return;
  $('submit').disabled = false;
  $('rerun').disabled = false;
  $('progress').hidden = true;
}

function allChecks() {
  const checks = [...state.audit.checks];
  for (const s of ['mobile', 'desktop']) {
    if (state.speed[s]) checks.push(...state.speed[s].checks);
    else if (state.speedErrors[s]) checks.push({
      category: 'speed', id: `psi-${s}`, weight: 3, status: 'info',
      title: `Rychlost na ${s === 'mobile' ? 'mobilu' : 'počítači'} se nepodařilo změřit`, detail: state.speedErrors[s],
      why: 'Rychlost měří Google stejným nástrojem jako PageSpeed Insights.', fix: 'Zkuste test spustit znovu za chvíli.',
    });
  }
  return checks;
}

function render() {
  const a = state.audit;
  const checks = allChecks();
  const scores = score(checks);
  const speedPending = ['mobile', 'desktop'].some(s => !state.speed[s] && !state.speedErrors[s]);
  const speedFailed = Object.keys(state.speedErrors).length > 0;
  const incomplete = speedFailed || a.incomplete;
  const values = Object.values(scores);
  const overall = values.length ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : 0;

  $('overall-num').textContent = overall;
  $('overall').setAttribute('aria-label', `Skóre provedených kontrol ${overall} ze 100${speedPending || incomplete ? ', výsledek není úplný' : ''}`);
  const ring = $('ring-fg');
  ring.style.strokeDashoffset = String(327 - (327 * overall) / 100);
  ring.style.stroke = overall >= 90 ? 'var(--pass)' : overall >= 60 ? 'var(--warn)' : 'var(--fail)';
  $('result-title').textContent = speedPending ? 'Průběžný výsledek testu' : incomplete ? 'Neúplný výsledek testu' : 'Výsledek automatického testu';
  $('result-url').textContent = a.finalUrl;
  const meta = [`Otestováno ${new Date(a.checkedAt).toLocaleString('cs-CZ')}`];
  if (a.cacheHit || Object.values(state.speed).some(s => s.cacheHit)) meta.push('Část výsledků je uložená z předchozího testu. Pro nové měření použijte „Změřit znovu“.');
  if (a.platforms.length) meta.push(`Platforma: ${a.platforms.join(', ')}`);
  const n = a.pages.length;
  meta.push(n ? `Test zahrnul zadanou stránku a ${n} dalších adres` : 'Test zahrnul zadanou stránku');
  if (speedPending) meta.push('Rychlost se ještě měří…');
  if (incomplete) meta.push('Část kontrol není dostupná; skóre je neúplné.');
  $('result-meta').textContent = meta.join(' · ');

  const cats = $('cats');
  cats.replaceChildren(...Object.entries(CATEGORIES).map(([key, name]) => {
    const pending = scores[key] == null;
    const running = pending && (key === 'speed' ? speedPending : key === 'a11y' && !state.speed.mobile && !state.speedErrors.mobile);
    const level = pending ? ' pending' : scores[key] >= 90 ? ' good' : scores[key] >= 50 ? ' mid' : ' bad';
    const hasGroup = checks.some(c => c.category === key);
    return el(hasGroup ? 'a' : 'div', { class: `cat${level}`, ...(hasGroup ? { href: `#group-${key}` } : {}) },
      el('strong', {}, pending ? (running ? '…' : '–') : String(scores[key])), el('span', {}, name));
  }));

  const openChecks = new Set([...$('checks').querySelectorAll('details[open]')].map(d => d.dataset.checkId));
  const focusedCheck = document.activeElement?.closest('details')?.dataset.checkId;
  const groups = Object.entries(CATEGORIES).map(([key, name]) => {
    const list = checks.filter(c => c.category === key).sort((x, y) => STATUS_ORDER[x.status] - STATUS_ORDER[y.status] || y.weight - x.weight);
    if (!list.length) return null;
    return el('section', { class: 'group', id: `group-${key}` },
      el('h3', {}, CATEGORY_QUESTIONS[key] || name), el('p', { class: 'group-name' }, name), ...list.map(c => renderCheck(c, openChecks.has(c.id))));
  }).filter(Boolean);
  $('checks').replaceChildren(...groups);
  if (focusedCheck) [...$('checks').querySelectorAll('details')].find(d => d.dataset.checkId === focusedCheck)?.querySelector('summary')?.focus({ preventScroll: true });

  // Formulář pro osobní audit: adresa webu a výsledek se vyplní samy (zprávu lze upravit)
  const host = new URL(a.finalUrl).hostname.replace(/^www\./, '');
  $('lead-web').value = a.finalUrl;
  $('lead-subject').value = `Dotaz k výsledku testu: ${host}`;
  const message = $('lead-message');
  if (!message.dataset.edited) {
    message.value = `Dobrý den, prosím o vysvětlení výsledku testu webu ${a.finalUrl}. Skóre dokončených kontrol: ${overall}/100${speedPending || incomplete ? ' (výsledek není úplný)' : ''}.`;
  }
  $('lead-result').value = resultSummary(a, checks, scores, overall, speedPending, incomplete);
}

// Shrnutí výsledku do e-mailu s žádostí o osobní audit (aby bylo hned vidět, co na webu je špatně)
function resultSummary(a, checks, scores, overall, speedPending, incomplete) {
  const lines = [`Skóre provedených kontrol: ${overall}/100${speedPending ? ' (rychlost se ještě měřila)' : incomplete ? ' (část kontrol není dostupná)' : ''}`];
  lines.push(Object.entries(CATEGORIES).filter(([k]) => scores[k] != null).map(([k, name]) => `${name}: ${scores[k]}`).join(' · '));
  const list = status => checks.filter(c => c.status === status).map(c => `- ${c.title}${c.detail ? ` — ${c.detail}` : ''}`.slice(0, 220));
  const fails = list('fail');
  const warns = list('warn');
  if (fails.length) lines.push('', 'Problémy:', ...fails);
  if (warns.length) lines.push('', 'Ke zlepšení:', ...warns);
  if (a.platforms.length) lines.push('', `Platforma: ${a.platforms.join(', ')}`);
  lines.push('', `Celý výsledek: https://testwebu.janyskovadigital.cz/?url=${encodeURIComponent(a.finalUrl)}`);
  return lines.join('\n').slice(0, 4900);
}

function renderCheck(c, open = false) {
  const copy = explanationCopy(c);
  const more = el('div', { class: 'check-more' });
  if (c.why) more.append(el('p', {}, el('strong', {}, copy.meaningLabel), c.why));
  if (copy.action) more.append(el('p', {}, el('strong', {}, copy.actionLabel), copy.action));
  return el('details', { class: `check ${c.status}`, 'data-check-id': c.id, ...(open ? { open: '' } : {}) },
    el('summary', {},
      el('span', { class: 'badge' }, checkStatusLabel(c)),
      el('span', { class: 'check-title' }, c.title),
      el('span', { class: 'check-detail' }, c.detail)),
    more);
}

$('lead-message').addEventListener('input', e => { e.target.dataset.edited = '1'; });

form.addEventListener('submit', e => {
  e.preventDefault();
  const value = input.value.trim();
  if (!value) { showError('Zadejte adresu webu, například vas-web.cz'); input.focus(); return; }
  try { run(normalizeUrl(value).href, { fresh: true }); }
  catch (error) { showError(error.message); input.setAttribute('aria-invalid', 'true'); input.focus(); }
});

$('rerun').addEventListener('click', () => {
  if (state?.audit && !$('submit').disabled) run(state.audit.url || state.audit.finalUrl, { fresh: true });
});

// Tisk (Ctrl+P): před tiskem rozbalí všechna
// vysvětlení a nastaví název souboru podle testovaného webu.
let titleBeforePrint = document.title;
let closedBeforePrint = [];
let printing = false;
window.addEventListener('beforeprint', () => {
  if (printing) return;
  printing = true;
  closedBeforePrint = [...document.querySelectorAll('details.check:not([open])')];
  closedBeforePrint.forEach(d => { d.open = true; });
  titleBeforePrint = document.title;
  if (state?.audit) {
    const host = new URL(state.audit.finalUrl).hostname.replace(/^www\./, '');
    document.title = `Audit webu ${host} ${new Date(state.audit.checkedAt).toLocaleDateString('cs-CZ')}`;
  }
});
window.addEventListener('afterprint', () => {
  printing = false;
  closedBeforePrint.forEach(d => { d.open = false; });
  document.title = titleBeforePrint;
});
$('share').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    $('share').textContent = 'Odkaz zkopírován ✓';
  } catch {
    $('share').textContent = location.href;
  }
});

// Na podporovaném telefonu otevře systémovou nabídku (např. WhatsApp).
if (typeof navigator.share === 'function') {
  $('share-device').hidden = false;
  $('share-device').addEventListener('click', async () => {
    try {
      await navigator.share({ title: 'Test webu zdarma | Janyskova Digital', url: location.href });
    } catch (e) {
      if (e.name !== 'AbortError') $('share-device').textContent = 'Použijte kopírování odkazu';
    }
  });
}

const initial = new URLSearchParams(location.search).get('url');
if (initial) {
  input.value = initial;
  try { run(normalizeUrl(initial).href); }
  catch (error) {
    showError(error.message);
    input.setAttribute('aria-invalid', 'true');
    const params = new URLSearchParams(location.search); params.delete('url');
    history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}`);
  }
}
