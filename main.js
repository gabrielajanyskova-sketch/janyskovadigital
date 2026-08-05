// ─── Mobile navigation ──────────────────────────────────────────────────────

const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobile-menu');

function closeMenu() {
  if (!mobileMenu || !hamburger) return;
  mobileMenu.classList.remove('open');
  hamburger.classList.remove('open');
  hamburger.setAttribute('aria-expanded', 'false');
  mobileMenu.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

if (hamburger && mobileMenu) {
  const closeBtn = document.createElement('button');
  closeBtn.className = 'menu-close';
  closeBtn.setAttribute('aria-label', 'Zavřít menu');
  closeBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  closeBtn.addEventListener('click', closeMenu);
  mobileMenu.appendChild(closeBtn);

  hamburger.addEventListener('click', function() {
    const open = mobileMenu.classList.toggle('open');
    hamburger.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', open);
    mobileMenu.setAttribute('aria-hidden', !open);
    document.body.style.overflow = open ? 'hidden' : '';
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && mobileMenu.classList.contains('open')) closeMenu();
  });
}

// ─── Pricing toggles ────────────────────────────────────────────────────────

function switchCare(tab) {
  ['basic', 'active', 'hourly'].forEach(function(t) {
    document.getElementById('care-' + t).style.display = t === tab ? 'block' : 'none';
    document.getElementById('care-btn-' + t).classList.toggle('active', t === tab);
  });
}

function switchRefresh(tab) {
  ['one', 'multi'].forEach(function(t) {
    document.getElementById('refresh-' + t).style.display = t === tab ? 'block' : 'none';
    document.getElementById('refresh-btn-' + t).classList.toggle('active', t === tab);
  });
}

// ─── Savings calculator ──────────────────────────────────────────────────────

(function() {
  const hostingEl = document.getElementById('k-hosting');
  if (!hostingEl) return;

  function fmt(n) { return Math.round(n).toLocaleString('cs-CZ') + ' Kč'; }

  function calc() {
    const h = +hostingEl.value;
    const s = +document.getElementById('k-sprava').value;
    const d = +document.getElementById('k-domena').value;
    const r = +document.getElementById('k-roky').value;

    document.getElementById('k-hosting-out').textContent = fmt(h);
    document.getElementById('k-sprava-out').textContent  = fmt(s);
    document.getElementById('k-domena-out').textContent  = fmt(d);
    document.getElementById('k-roky-out').textContent    = r + (r === 1 ? ' rok' : r < 5 ? ' roky' : ' let');

    const ted    = (h + s + d) * r;
    const jd     = 5900 + d * r;
    const uspora = Math.max(0, ted - jd);
    const max    = Math.max(ted, jd, 1);

    document.getElementById('k-ted').textContent     = fmt(ted);
    document.getElementById('k-jd').textContent      = fmt(jd);
    document.getElementById('k-uspora').textContent  = fmt(uspora);
    document.getElementById('k-bar-ted').style.width = Math.round(ted / max * 100) + '%';
    document.getElementById('k-bar-jd').style.width  = Math.round(jd  / max * 100) + '%';
  }

  ['k-hosting', 'k-sprava', 'k-domena', 'k-roky'].forEach(function(id) {
    document.getElementById(id).addEventListener('input', calc);
  });
  calc();
}());

// ─── Score counter ───────────────────────────────────────────────────────────

setTimeout(function() {
  document.querySelectorAll('.score-num').forEach(function(el) {
    const target = parseInt(el.dataset.target, 10);
    const start  = performance.now();
    requestAnimationFrame(function tick(now) {
      const p = Math.min((now - start) / 1400, 1);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(e * target);
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = target;
    });
  });
}, 600);

// ─── Reveal on scroll ────────────────────────────────────────────────────────

document.documentElement.classList.add('js-ready');

const revealObs = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.08 });

document.querySelectorAll('.reveal').forEach(function(el) { revealObs.observe(el); });

// ─── Reference slider ────────────────────────────────────────────────────────

(function() {
  const track = document.getElementById('refTrack');
  const prev  = document.getElementById('refPrev');
  const next  = document.getElementById('refNext');
  if (!track || !prev || !next) return;

  let maxScroll = 0;
  let viewW = 0;

  function measure() {
    viewW     = track.clientWidth;
    maxScroll = track.scrollWidth - viewW - 2;
  }

  function updateBtns() {
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = maxScroll <= 2 || track.scrollLeft >= maxScroll;
  }

  prev.addEventListener('click', function() { track.scrollBy({ left: -viewW, behavior: 'smooth' }); });
  next.addEventListener('click', function() { track.scrollBy({ left:  viewW, behavior: 'smooth' }); });
  track.addEventListener('scroll', updateBtns, { passive: true });
  window.addEventListener('resize', function() {
    requestAnimationFrame(function() { measure(); updateBtns(); });
  });
  requestAnimationFrame(function() { measure(); updateBtns(); });
}());

// ─── Contact form ─────────────────────────────────────────────────────────────

(function() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  const submitBtn = form.querySelector('button[type="submit"]');
  const origLabel = submitBtn.innerHTML;

  function showMsg(text, type) {
    const old = form.querySelector('.form-msg');
    if (old) old.remove();
    const div = document.createElement('div');
    div.className = 'form-msg';
    div.style.cssText = 'margin-top:12px;padding:12px 18px;border-radius:10px;font-size:14px;' +
      (type === 'error'
        ? 'background:rgba(255,80,80,0.08);border:1px solid rgba(255,80,80,0.25);color:#ff7080;'
        : 'background:rgba(0,229,160,0.08);border:1px solid rgba(0,229,160,0.25);color:var(--green);');
    div.textContent = text;
    form.appendChild(div);
  }

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const jmeno  = form.querySelector('#jmeno').value.trim();
    const email  = form.querySelector('#email').value.trim();
    const zprava = form.querySelector('#zprava').value.trim();
    if (!jmeno || !email || !zprava) { showMsg('Vyplňte prosím všechna pole.', 'error'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showMsg('Zadejte platnou e-mailovou adresu.', 'error'); return; }

    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Odesílám…';

    try {
      const res  = await fetch('https://api.web3forms.com/submit', { method: 'POST', body: new FormData(form) });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Chyba serveru');
      window.location.href = 'https://janyskovadigital.cz/podekovani.html';
    } catch {
      showMsg('Něco se pokazilo. Zkuste to znovu nebo mi napište přímo na info@janyskovadigital.cz', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = origLabel;
    }
  });
}());

// ─── Exit-intent popup ───────────────────────────────────────────────────────

(function() {
  const KEY   = 'audit_popup_seen';
  const popup = document.getElementById('audit-popup');
  if (!popup || sessionStorage.getItem(KEY)) return;

  const closeBtn = document.getElementById('audit-close');
  const ctaBtn   = document.getElementById('audit-cta');
  let shown = false;

  function show() {
    if (shown || sessionStorage.getItem(KEY)) return;
    shown = true;
    popup.style.display = 'flex';
    sessionStorage.setItem(KEY, '1');
  }

  function hide() { popup.style.display = 'none'; }

  if (closeBtn) closeBtn.addEventListener('click', hide);
  if (ctaBtn)   ctaBtn.addEventListener('click', hide);
  popup.addEventListener('click', function(e) { if (e.target === popup) hide(); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') hide(); });

  let exitFired = false;
  document.addEventListener('mouseleave', function(e) {
    if (e.clientY < 10 && !exitFired) { exitFired = true; setTimeout(show, 300); }
  });
  setTimeout(show, /Mobi|Android/i.test(navigator.userAgent) ? 12000 : 25000);
}());

// ─── Chatbot ──────────────────────────────────────────────────────────────────

(function() {
  const KB = [
    { keys: ['cen', 'kolik', 'stoj', 'cena', 'cenu', 'cenov', 'price'],
      a: 'One-page web (Web Start) je za 5 900 Kč. Vícestránkový web (Web Business) od 12 000 do 20 000 Kč dle rozsahu — cena je vždy jasná předem. Hosting je v ceně, dál platíte jen doménu ~200 Kč/rok.' },
    { keys: ['dlouho', 'trva', 'kdy', 'lhut', 'tyden', 'doba', 'rychle'],
      a: 'První náhled máte do 48 hodin od schůzky. Hotový web je obvykle do 7–14 dní — záleží na rozsahu a jak rychle dodáte podklady.' },
    { keys: ['barter', 'vymeni', 'bez penez', 'vymena'],
      a: 'Barter je výměna — web za vaše produkty nebo služby. Hodí se třeba pro kadeřnice, kosmetičky nebo cukrářky. Kvalita stejná jako u placené zakázky, jen bez peněz.' },
    { keys: ['funguj', 'postup', 'proces', 'jak to', 'krok', 'vyroba', 'zacin', 'spoluprac'],
      a: 'Vyplníte formulář → domluvíme se na obsahu a designu → do 48 h máte první náhled → po schválení web spustíme. Bez WordPressu, bez měsíčních poplatků.' },
    { keys: ['kontakt', 'email', 'telefon', 'napsat', 'napiss', 'zavolat', 'mail', 'spojit'],
      a: 'Napište na info@janyskovadigital.cz nebo zavolejte na +420 739 395 800. Nebo vyplňte formulář níže — ozveme se do 24 hodin.' },
    { keys: ['wordpress', 'wp', 'sablona', 'template', 'wix', 'squarespace'],
      a: 'Nepracujeme s WordPressem ani šablonami — každý web je psaný v čistém kódu. Proto mají PageSpeed skóre 100 a neplatíte za hosting ani drahé pluginy.' },
    { keys: ['hosting', 'domena', 'domain', 'server', 'provoz', 'platit'],
      a: 'Hosting je navždy v ceně tvorby — neplatíte nic navíc. Dál platíte jen doménu, přibližně 200 Kč ročně.' },
    { keys: ['seo', 'vyhledava', 'google', 'pozice', 'hleda', 'najde'],
      a: 'SEO je součástí každého webu — správná struktura, meta tagy, rychlost načítání, schéma dat. Součástí je i napojení na Google Search Console.' },
    { keys: ['refresh', 'predelat', 'prevest', 'existujici', 'stavajic'],
      a: 'Web Refresh je převod stávajícího webu z WordPressu na čistý kód. Jednostránkový za 8 900 Kč, vícestránkový od 14 900 Kč. Výsledek: rychlejší web bez drahého hostingu.' },
    { keys: ['sprava', 'care', 'aktualizac', 'update', 'obsah', 'zmen'],
      a: 'Web Care (správa webu) začíná od 490 Kč/měsíc — základní plán. Standard je 990 Kč/měsíc. Nebo hodinově za 850 Kč/hod. Zahrnuje aktualizace obsahu a technický dohled.' },
    { keys: ['firma', 'maps', 'mapa', 'mistni', 'profil'],
      a: 'Nastavení Profilu firmy na Googlu (Google Maps) je za 790 Kč. Pomůže vám být vidět ve výsledcích pro místní vyhledávání.' }
  ];

  const FALLBACK = 'To přesně nevím, ale rádi odpovíme osobně. Napište na info@janyskovadigital.cz nebo vyplňte formulář níže — ozveme se do 24 hodin.';
  const CHIPS = [
    { label: 'Kolik stojí web?',        idx: 0 },
    { label: 'Jak dlouho trvá výroba?', idx: 1 },
    { label: 'Co je barter?',           idx: 2 },
    { label: 'Jak to funguje?',         idx: 3 },
    { label: 'Jak vás kontaktovat?',    idx: 4 }
  ];

  const toggle = document.getElementById('chat-toggle');
  const panel  = document.getElementById('chat-panel');
  if (!toggle || !panel) return;

  const iconOpen  = document.getElementById('chat-icon-open');
  const iconClose = document.getElementById('chat-icon-close');
  const messages  = document.getElementById('chat-messages');
  const input     = document.getElementById('chat-input');
  const sendBtn   = document.getElementById('chat-send');

  function addMsg(text, type, withCTA) {
    const el = document.createElement('div');
    el.className = 'chat-bubble chat-bubble--' + type;
    el.textContent = text;
    messages.appendChild(el);
    if (withCTA) {
      const a = document.createElement('a');
      a.href = '#kontakt';
      a.className = 'chat-cta-inline';
      a.textContent = 'Mám zájem o web →';
      a.addEventListener('click', closePanel);
      messages.appendChild(a);
    }
    messages.scrollTop = messages.scrollHeight;
  }

  function addChips() {
    const wrap = document.createElement('div');
    wrap.className = 'chat-chips';
    CHIPS.forEach(function(c) {
      const btn = document.createElement('button');
      btn.className = 'chat-chip';
      btn.textContent = c.label;
      btn.addEventListener('click', function() {
        wrap.remove();
        addMsg(c.label, 'user');
        setTimeout(function() { addMsg(KB[c.idx].a, 'bot', true); }, 320);
      });
      wrap.appendChild(btn);
    });
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
  }

  function getAnswer(text) {
    const t = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    for (let i = 0; i < KB.length; i++) {
      for (let j = 0; j < KB[i].keys.length; j++) {
        if (t.includes(KB[i].keys[j])) return KB[i].a;
      }
    }
    return null;
  }

  function sendMessage() {
    const val = input.value.trim();
    if (!val) return;
    input.value = '';
    addMsg(val, 'user');
    setTimeout(function() {
      const ans = getAnswer(val);
      addMsg(ans || FALLBACK, 'bot', !!ans);
    }, 350);
  }

  function closePanel() {
    panel.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    panel.setAttribute('aria-hidden', 'true');
    if (iconOpen)  iconOpen.style.display  = '';
    if (iconClose) iconClose.style.display = 'none';
  }

  let initialized = false;
  toggle.addEventListener('click', function() {
    const open = panel.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
    panel.setAttribute('aria-hidden', !open);
    if (iconOpen)  iconOpen.style.display  = open ? 'none' : '';
    if (iconClose) iconClose.style.display = open ? ''     : 'none';
    if (open && !initialized) {
      initialized = true;
      addMsg('Dobrý den! Jsem automatický chatbot se základními informacemi. Pro osobní odpověď napište na info@janyskovadigital.cz nebo zavolejte na +420 739 395 800. Co vás zajímá?', 'bot');
      setTimeout(addChips, 200);
    }
    if (open) setTimeout(function() { input.focus(); }, 300);
  });

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', function(e) { if (e.key === 'Enter') sendMessage(); });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && panel.classList.contains('open')) closePanel();
  });
}());

// ─── Scroll progress bar ─────────────────────────────────────────────────────

(function() {
  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  document.body.prepend(bar);
  window.addEventListener('scroll', function() {
    const s = document.documentElement;
    bar.style.width = (s.scrollTop / (s.scrollHeight - s.clientHeight) * 100) + '%';
  }, { passive: true });
}());

// ─── Theme toggle ─────────────────────────────────────────────────────────────

(function() {
  const sunSvg  = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  const moonSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  let theme = localStorage.getItem('jd-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);

  function makeBtn() {
    const b = document.createElement('button');
    b.className = 'theme-toggle';
    b.setAttribute('aria-label', 'Přepnout světlé/tmavé téma');
    b.innerHTML = theme === 'dark' ? sunSvg : moonSvg;
    b.addEventListener('click', function() {
      theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('jd-theme', theme);
      document.querySelectorAll('.theme-toggle').forEach(function(tb) {
        tb.innerHTML = theme === 'dark' ? sunSvg : moonSvg;
      });
    });
    return b;
  }

  const hamburgerBtn = document.getElementById('hamburger');
  if (hamburgerBtn) hamburgerBtn.parentNode.insertBefore(makeBtn(), hamburgerBtn);

  const fullMenu = document.getElementById('mobile-menu');
  if (fullMenu) {
    const mb = makeBtn();
    mb.style.cssText = 'margin:20px auto 0;width:44px;height:44px;opacity:1;transform:none;';
    fullMenu.appendChild(mb);
  }
}());

// ─── Sticky mobile CTA ───────────────────────────────────────────────────────

(function() {
  const cta = document.createElement('div');
  cta.className = 'sticky-mobile-cta';
  cta.innerHTML = '<a href="#kontakt">Mám zájem <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></a>';
  document.body.appendChild(cta);

  let shown = false;
  const kontakt = document.getElementById('kontakt');

  window.addEventListener('scroll', function() {
    const past   = window.scrollY > 500;
    const atCta  = kontakt && kontakt.getBoundingClientRect().top < window.innerHeight * 0.85;
    const should = past && !atCta;
    if (should !== shown) { shown = should; cta.classList.toggle('visible', shown); }
  }, { passive: true });
}());

// ─── Process carousel ────────────────────────────────────────────────────────

(function() {
  var cards = document.querySelectorAll('.process-focus-card');
  var dots  = document.querySelectorAll('.process-dot');
  if (!cards.length) return;

  var current = 0;
  var timer;

  function advance() { window.setStep((current + 1) % cards.length); }

  window.setStep = function(n) {
    cards[current].classList.remove('active');
    dots[current].classList.remove('active');
    current = n;
    cards[current].classList.add('active');
    dots[current].classList.add('active');
    clearInterval(timer);
    timer = setInterval(advance, 3200);
  };

  cards.forEach(function(card, i) {
    card.addEventListener('click', function() { if (i !== current) window.setStep(i); });
  });

  timer = setInterval(advance, 3200);
}());

// ─── Magnet buttons ──────────────────────────────────────────────────────────

(function() {
  if (window.matchMedia('(hover: none)').matches) return;

  document.querySelectorAll('.btn-primary').forEach(function(btn) {
    btn.addEventListener('mousemove', function(e) {
      const rect = btn.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width  / 2) * 0.22;
      const y = (e.clientY - rect.top  - rect.height / 2) * 0.22;
      btn.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    });
    btn.addEventListener('mouseleave', function() {
      btn.style.transform = '';
    });
  });
}());
