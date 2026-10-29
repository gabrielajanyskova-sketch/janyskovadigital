// Stránka testu webu: spustí audit a dvě měření rychlosti souběžně a průběžně vykresluje výsledky.
// Data z testovaného webu se vkládají jen jako text (textContent), nikdy jako HTML.

import { CATEGORIES, CATEGORY_QUESTIONS, score } from '../lib/checks.js';

const $ = id => document.getElementById(id);
const form = $('audit-form');
const input = $('url');
const STATUS_ORDER = { fail: 0, warn: 1, pass: 2, info: 3 };
const STATUS_LABEL = { pass: 'V pořádku', warn: 'Zlepšit', fail: 'Problém', info: 'Info' };

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

async function getJson(url, options) {
  const res = await fetch(url, { ...options, signal: controller.signal });
  const data = await res.json().catch(() => null);
  if (res.ok && data) return data;
  if (data?.error) throw new Error(data.error);
  // Odpověď není od aplikace (chybová stránka Cloudflaru): ukázat srozumitelný důvod a kód
  const reason = res.status === 429 ? 'Příliš mnoho testů za krátkou dobu, zkuste to za minutu.'
    : res.status >= 520 ? 'Měření trvalo příliš dlouho nebo spadlo, zkuste to znovu.'
    : 'Neočekávaná odpověď serveru.';
  throw new Error(`${reason} (kód ${res.status})`);
}

async function run(url) {
  controller?.abort();
  controller = new AbortController();
  $('form-error').hidden = true;
  $('results').hidden = true;
  $('progress').hidden = false;
  $('submit').disabled = true;
  ['audit', 'mobile', 'desktop'].forEach(s => setStep(s, 'running'));
  state = { audit: null, speed: {}, speedErrors: {} };

  const params = new URLSearchParams(location.search);
  params.set('url', url);
  history.replaceState(null, '', `?${params}`);

  const speed = strategy => getJson(`/api/speed?url=${encodeURIComponent(url)}&strategy=${strategy}`)
    .then(data => { state.speed[strategy] = data; setStep(strategy, 'done'); })
    .catch(e => { if (e.name === 'AbortError') return; state.speedErrors[strategy] = e.message; setStep(strategy, 'failed'); })
    .finally(() => state.audit && render());

  const mobile = speed('mobile');
  const desktop = speed('desktop');

  try {
    state.audit = await getJson('/api/audit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    setStep('audit', 'done');
    render();
    $('results').hidden = false;
    $('results').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  } catch (e) {
    if (e.name === 'AbortError') return;
    controller.abort();
    $('progress').hidden = true;
    showError(e.message);
    $('submit').disabled = false;
    return;
  }
  await Promise.allSettled([mobile, desktop]);
  $('submit').disabled = false;
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
  const speedPending = !state.speed.mobile && !state.speedErrors.mobile;
  const values = Object.values(scores);
  const overall = values.length ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : 0;

  $('overall-num').textContent = overall;
  $('overall').setAttribute('aria-label', `Celkové skóre ${overall} ze 100`);
  const ring = $('ring-fg');
  ring.style.strokeDashoffset = String(327 - (327 * overall) / 100);
  ring.style.stroke = overall >= 90 ? 'var(--pass)' : overall >= 60 ? 'var(--warn)' : 'var(--fail)';
  $('result-title').textContent = overall >= 90 ? 'Výborný web' : overall >= 75 ? 'Dobrý základ, je co zlepšit' : overall >= 50 ? 'Web potřebuje péči' : 'Web má vážné nedostatky';
  $('result-url').textContent = a.finalUrl;
  const meta = [`Otestováno ${new Date(a.checkedAt).toLocaleString('cs-CZ')}`];
  if (a.platforms.length) meta.push(`Platforma: ${a.platforms.join(', ')}`);
  const n = a.pages.length;
  meta.push(n ? `Zkontrolována úvodní stránka a ${n} ${n === 1 ? 'další stránka' : n <= 4 ? 'další stránky' : 'dalších stránek'}` : 'Zkontrolována úvodní stránka');
  if (speedPending) meta.push('Rychlost se ještě měří…');
  $('result-meta').textContent = meta.join(' · ');

  const cats = $('cats');
  cats.replaceChildren(...Object.entries(CATEGORIES).map(([key, name]) => {
    const pending = scores[key] == null;
    const running = pending && ['speed', 'a11y'].includes(key) && !state.speedErrors.mobile;
    const level = pending ? ' pending' : scores[key] >= 90 ? ' good' : scores[key] >= 50 ? ' mid' : ' bad';
    return el('a', { class: `cat${level}`, href: `#group-${key}` },
      el('strong', {}, pending ? (running ? '…' : '–') : String(scores[key])), el('span', {}, name));
  }));

  const groups = Object.entries(CATEGORIES).map(([key, name]) => {
    const list = checks.filter(c => c.category === key).sort((x, y) => STATUS_ORDER[x.status] - STATUS_ORDER[y.status] || y.weight - x.weight);
    if (!list.length) return null;
    return el('section', { class: 'group', id: `group-${key}` },
      el('h3', {}, CATEGORY_QUESTIONS[key] || name), el('p', { class: 'group-name' }, name), ...list.map(renderCheck));
  }).filter(Boolean);
  $('checks').replaceChildren(...groups);

  // Formulář pro osobní audit: adresa webu a výsledek se vyplní samy (zprávu lze upravit)
  const host = new URL(a.finalUrl).hostname.replace(/^www\./, '');
  $('lead-web').value = a.finalUrl;
  $('lead-subject').value = `Žádost o osobní audit: ${host}`;
  const message = $('lead-message');
  if (!message.dataset.edited) {
    message.value = `Dobrý den, prosím o osobní audit webu ${a.finalUrl}. Automatický test mu dal ${overall}/100.`;
  }
  $('lead-result').value = resultSummary(a, checks, scores, overall, speedPending);
}

// Shrnutí výsledku do e-mailu s žádostí o osobní audit (aby bylo hned vidět, co na webu je špatně)
function resultSummary(a, checks, scores, overall, speedPending) {
  const lines = [`Celkové skóre: ${overall}/100${speedPending ? ' (rychlost se ještě měřila)' : ''}`];
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

function renderCheck(c) {
  const more = el('div', { class: 'check-more' });
  if (c.why) more.append(el('p', {}, el('strong', {}, 'Proč na tom záleží: '), c.why));
  if (c.fix && c.fix !== '—') more.append(el('p', {}, el('strong', {}, 'Jak to opravit: '), c.fix));
  return el('details', { class: `check ${c.status}` },
    el('summary', {},
      el('span', { class: 'badge' }, STATUS_LABEL[c.status]),
      el('span', { class: 'check-title' }, c.title),
      el('span', { class: 'check-detail' }, c.detail)),
    more);
}

$('lead-message').addEventListener('input', e => { e.target.dataset.edited = '1'; });

form.addEventListener('submit', e => {
  e.preventDefault();
  const value = input.value.trim();
  if (!value) { showError('Zadejte adresu webu, například vas-web.cz'); input.focus(); return; }
  run(value);
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

const initial = new URLSearchParams(location.search).get('url');
if (initial) { input.value = initial; run(initial); }
