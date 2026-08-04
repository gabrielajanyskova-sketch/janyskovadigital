// Nav / hamburger
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

function switchCare(tab) {
  ['basic', 'active', 'hourly'].forEach(function(t) {
    document.getElementById('care-' + t).style.display = 'none';
    document.getElementById('care-btn-' + t).classList.remove('active');
  });
  document.getElementById('care-' + tab).style.display = 'block';
  document.getElementById('care-btn-' + tab).classList.add('active');
}

function switchRefresh(tab) {
  ['one', 'multi'].forEach(function(t) {
    document.getElementById('refresh-' + t).style.display = 'none';
    document.getElementById('refresh-btn-' + t).classList.remove('active');
  });
  document.getElementById('refresh-' + tab).style.display = 'block';
  document.getElementById('refresh-btn-' + tab).classList.add('active');
}

if (hamburger && mobileMenu) {
  // Close button inside the menu (hamburger is behind z-index of overlay)
  var closeBtn = document.createElement('button');
  closeBtn.setAttribute('aria-label', 'Zavřít menu');
  closeBtn.style.cssText = 'position:absolute;top:20px;right:20px;background:none;border:none;color:var(--text-dim);cursor:pointer;padding:8px;opacity:1;transform:none;line-height:1;';
  closeBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  closeBtn.addEventListener('click', closeMenu);
  mobileMenu.appendChild(closeBtn);

  hamburger.addEventListener('click', function() {
    var open = mobileMenu.classList.toggle('open');
    hamburger.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', open);
    mobileMenu.setAttribute('aria-hidden', !open);
    document.body.style.overflow = open ? 'hidden' : '';
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && mobileMenu.classList.contains('open')) closeMenu();
  });
}

// Kalkulačka
(function() {
  function fmt(n) { return Math.round(n).toLocaleString('cs-CZ') + ' Kč'; }
  function calc() {
    var hosting = parseInt(document.getElementById('k-hosting').value);
    var sprava  = parseInt(document.getElementById('k-sprava').value);
    var domena  = parseInt(document.getElementById('k-domena').value);
    var roky    = parseInt(document.getElementById('k-roky').value);
    document.getElementById('k-hosting-out').textContent = fmt(hosting);
    document.getElementById('k-sprava-out').textContent  = fmt(sprava);
    document.getElementById('k-domena-out').textContent  = fmt(domena);
    document.getElementById('k-roky-out').textContent    = roky + (roky === 1 ? ' rok' : roky < 5 ? ' roky' : ' let');
    var ted    = (hosting + sprava + domena) * roky;
    var jd     = 5900 + domena * roky;
    var uspora = Math.max(0, ted - jd);
    document.getElementById('k-ted').textContent    = fmt(ted);
    document.getElementById('k-jd').textContent     = fmt(jd);
    document.getElementById('k-uspora').textContent = fmt(uspora);
    var max = Math.max(ted, jd, 1);
    document.getElementById('k-bar-ted').style.width = Math.round(ted / max * 100) + '%';
    document.getElementById('k-bar-jd').style.width  = Math.round(jd  / max * 100) + '%';
  }
  if (!document.getElementById('k-hosting')) return;
  ['k-hosting', 'k-sprava', 'k-domena', 'k-roky'].forEach(function(id) {
    document.getElementById(id).addEventListener('input', calc);
  });
  calc();
}());

// Score counter animation
setTimeout(function() {
  document.querySelectorAll('.score-num').forEach(function(el) {
    var target = parseInt(el.dataset.target, 10);
    var start  = performance.now();
    requestAnimationFrame(function tick(now) {
      var p = Math.min((now - start) / 1400, 1);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(e * target);
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = target;
    });
  });
}, 600);

// Reveal on scroll
document.documentElement.classList.add('js-ready');
var revealObs = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.08 });
document.querySelectorAll('.reveal').forEach(function(el) { revealObs.observe(el); });

// Reference slider
(function() {
  var track = document.getElementById('refTrack');
  var prev  = document.getElementById('refPrev');
  var next  = document.getElementById('refNext');
  if (!track || !prev || !next) return;
  var maxScroll = 0, viewW = 0;
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
  window.addEventListener('resize', function() { requestAnimationFrame(function() { measure(); updateBtns(); }); });
  requestAnimationFrame(function() { measure(); updateBtns(); });
}());

// Contact form
(function() {
  var form = document.getElementById('contact-form');
  if (!form) return;
  var submitBtn  = form.querySelector('button[type="submit"]');
  var origLabel  = submitBtn.innerHTML;

  function showMsg(text, type) {
    var old = form.querySelector('.form-msg');
    if (old) old.remove();
    var div = document.createElement('div');
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
    var jmeno  = form.querySelector('#jmeno').value.trim();
    var email  = form.querySelector('#email').value.trim();
    var zprava = form.querySelector('#zprava').value.trim();
    if (!jmeno || !email || !zprava) { showMsg('Vyplňte pros\xedm všechna pole.', 'error'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showMsg('Zadejte platnou e-mailovou adresu.', 'error'); return; }
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Odes\xedl\xe1m… <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" style="animation:spin 0.8s linear infinite;transform-origin:center"/></svg>';
    try {
      var res  = await fetch('https://api.web3forms.com/submit', { method: 'POST', body: new FormData(form) });
      var data = await res.json();
      if (!data.success) throw new Error(data.message || 'Chyba serveru');
      window.location.href = 'https://janyskovadigital.cz/podekovani.html';
    } catch (err) {
      showMsg('Něco se pokazilo. Zkuste to znovu nebo mi napište př\xedmo na info@janyskovadigital.cz', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = origLabel;
    }
  });
}());

// Audit popup
(function() {
  var KEY      = 'audit_popup_seen';
  if (sessionStorage.getItem(KEY)) return;
  var popup    = document.getElementById('audit-popup');
  if (!popup) return;
  var closeBtn = document.getElementById('audit-close');
  var ctaBtn   = document.getElementById('audit-cta');
  var shown    = false;

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

  var exitFired = false;
  document.addEventListener('mouseleave', function(e) {
    if (e.clientY < 10 && !exitFired) { exitFired = true; setTimeout(show, 300); }
  });
  var delay = /Mobi|Android/i.test(navigator.userAgent) ? 12000 : 25000;
  setTimeout(show, delay);
}());

// Chatbot
(function() {
  var KB = [
    { keys: ['cen', 'kolik', 'stoj', 'cena', 'cenu', 'cenov', 'price'],
      a: 'One-page web (Web Start) je za 5 900 Kč. V\xedcest\xe1nkov\xfd web (Web Business) od 12 000 do 20 000 Kč dle rozsahu — cena je vždy jasn\xe1 předem. Hosting je v ceně, d\xe1l plat\xedte jen dom\xe9nu ~200 Kč/rok.' },
    { keys: ['dlouho', 'trv\xe1', 'trva', 'kdy', 'lhůt', 'lhut', 't\xfdden', 'tyden', 'doba', 'čas', 'rychle'],
      a: 'Prvn\xed n\xe1hled m\xe1te do 48 hodin od schůzky. Hotov\xfd web je obvykle do 7–14 dn\xed — z\xe1lež\xed na rozsahu a jak rychle dod\xe1te podklady.' },
    { keys: ['barter', 'v\xfdměn', 'vymeni', 'v\xfdměna', 'bez peněz', 'bez penez', 'v\xfdmena'],
      a: 'Barter je v\xfdměna — web za vaše produkty nebo služby. Hod\xed se třeba pro kadeřnice, kosmečky nebo cukř\xe1řky. Kvalita stejn\xe1 jako u placen\xe9 zak\xe1zky, jen bez peněz.' },
    { keys: ['funguj', 'postup', 'proces', 'jak to', 'krok', 'v\xfdroba', 'vyroba', 'zač\xedn', 'zacin', 'spoluprac'],
      a: 'Vyplн\xedte formul\xe1ř → doml\xedv\xedme se na obsahu a designu → do 48 h m\xe1te prvn\xed n\xe1hled → po schv\xe1len\xed web spust\xedme. Bez WordPressu, bez měs\xedčn\xedch poplatků.' },
    { keys: ['kontakt', 'email', 'telefon', 'napsat', 'napiš', 'napiss', 'zavolat', 'mail', 'spojit'],
      a: 'Napište na info@janyskovadigital.cz nebo zavolejte na +420 739 395 800. Nebo vyplnte formul\xe1ř n\xedže — ozveme se do 24 hodin.' },
    { keys: ['wordpress', 'wp', 'šablona', 'sablona', 'template', 'wix', 'squarespace'],
      a: 'Nepracujeme s WordPressem ani šablonami — každ\xfd web je psan\xfd v čist\xe9m k\xf3du. Proto maj\xed PageSpeed sk\xf3re 100 a neplat\xedte za hosting ani drah\xe9 pluginy.' },
    { keys: ['hosting', 'dom\xe9na', 'domena', 'domain', 'server', 'provoz', 'platit'],
      a: 'Hosting je navždy v ceně tvorby — neplat\xedte nic nav\xedc. D\xe1l plat\xedte jen dom\xe9nu, přibližně 200 Kč ročně.' },
    { keys: ['seo', 'vyhledava', 'google', 'pozice', 'hled\xe1', 'najde'],
      a: 'SEO je souč\xe1st\xed každ\xe9ho webu — spr\xe1vn\xe1 struktura, meta tagy, rychlost nač\xedt\xe1n\xed, sch\xe9ma dat. Souč\xe1st\xed je i napojen\xed na Google Search Console.' },
    { keys: ['refresh', 'předelat', 'predělat', 'předělat', 'přev\xe9st', 'prevest', 'existujici', 'existuj\xedc\xed', 'st\xe1vaj\xedc'],
      a: 'Web Refresh je převod st\xe1vaj\xedc\xedho webu z WordPressu na čist\xfd k\xf3d. Jednostr\xe1nkov\xfd za 8 900 Kč, v\xedcest\xe1nkov\xfd od 14 900 Kč. V\xfdsledek: rychlejš\xed web bez drah\xe9ho hostingu.' },
    { keys: ['spr\xe1va', 'sprava', 'care', 'aktualizac', 'update', 'obsah', 'změn'],
      a: 'Web Care (spr\xe1va webu) zač\xedn\xe1 od 490 Kč/měs\xedc — z\xe1kladn\xed pl\xe1n. Standard je 990 Kč/měs\xedc. Nebo hodinově za 850 Kč/hod. Zahrnuje aktualizace obsahu a technick\xfd dohled.' },
    { keys: ['firem', 'firma', 'maps', 'mapa', 'm\xedstn\xed', 'mistni', 'profil'],
      a: 'Nastaven\xed Profilu firmy na Googlu (Google Maps) je za 790 Kč. Pomůže v\xe1m b\xfdt vidět ve v\xfdsledc\xedch pro m\xedstn\xed vyhled\xe1v\xe1n\xed.' }
  ];
  var FALLBACK = 'To přesně nev\xedm, ale r\xe1di odpov\xedme osobně. Napište na info@janyskovadigital.cz nebo vyplňte formul\xe1ř n\xedže — ozveme se do 24 hodin.';
  var CHIPS = [
    { label: 'Kolik stoj\xed web?', idx: 0 },
    { label: 'Jak dlouho trv\xe1 v\xfdroba?', idx: 1 },
    { label: 'Co je barter?', idx: 2 },
    { label: 'Jak to funguje?', idx: 3 },
    { label: 'Jak v\xe1s kontaktovat?', idx: 4 }
  ];

  var toggle   = document.getElementById('chat-toggle');
  var panel    = document.getElementById('chat-panel');
  if (!toggle || !panel) return;
  var iconOpen  = document.getElementById('chat-icon-open');
  var iconClose = document.getElementById('chat-icon-close');
  var messages  = document.getElementById('chat-messages');
  var input     = document.getElementById('chat-input');
  var sendBtn   = document.getElementById('chat-send');

  function addMsg(text, type, withCTA) {
    var el = document.createElement('div');
    el.className = 'chat-bubble chat-bubble--' + type;
    el.textContent = text;
    messages.appendChild(el);
    if (withCTA) {
      var a = document.createElement('a');
      a.href = '#kontakt';
      a.className = 'chat-cta-inline';
      a.textContent = 'M\xe1m z\xe1jem o web →';
      a.addEventListener('click', closePanel);
      messages.appendChild(a);
    }
    messages.scrollTop = messages.scrollHeight;
  }

  function addChips() {
    var wrap = document.createElement('div');
    wrap.className = 'chat-chips';
    CHIPS.forEach(function(c) {
      var btn = document.createElement('button');
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
    var t = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    for (var i = 0; i < KB.length; i++) {
      for (var j = 0; j < KB[i].keys.length; j++) {
        if (t.indexOf(KB[i].keys[j]) !== -1) return KB[i].a;
      }
    }
    return null;
  }

  function sendMessage() {
    var val = input.value.trim();
    if (!val) return;
    input.value = '';
    addMsg(val, 'user');
    setTimeout(function() {
      var ans = getAnswer(val);
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

  var initialized = false;
  toggle.addEventListener('click', function() {
    var open = panel.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
    panel.setAttribute('aria-hidden', !open);
    if (iconOpen)  iconOpen.style.display  = open ? 'none' : '';
    if (iconClose) iconClose.style.display = open ? '' : 'none';
    if (open && !initialized) {
      initialized = true;
      addMsg('Dobr\xfd den! Jsem automatick\xfd chatbot se z\xe1kladn\xedmi informacemi. Pro osobn\xed odpověď napište na info@janyskovadigital.cz nebo zavolejte na +420 739 395 800. Co v\xe1s zaj\xedm\xe1?', 'bot');
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

// Scroll progress bar
(function() {
  var bar = document.createElement('div');
  bar.className = 'scroll-progress';
  document.body.prepend(bar);
  window.addEventListener('scroll', function() {
    var s = document.documentElement;
    bar.style.width = (s.scrollTop / (s.scrollHeight - s.clientHeight) * 100) + '%';
  }, { passive: true });
}());

// Dark / light theme toggle
(function() {
  var sunSvg  = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  var moonSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  var theme = localStorage.getItem('jd-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);

  function makeBtn() {
    var b = document.createElement('button');
    b.className = 'theme-toggle';
    b.setAttribute('aria-label', 'Přepnout světl\xe9/tmav\xe9 t\xe9ma');
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

  var hamburgerBtn = document.getElementById('hamburger');
  if (hamburgerBtn) hamburgerBtn.parentNode.insertBefore(makeBtn(), hamburgerBtn);

  var fullMenu = document.getElementById('mobile-menu');
  if (fullMenu) {
    var mb = makeBtn();
    mb.style.cssText = 'margin:20px auto 0;width:44px;height:44px;opacity:1;transform:none;';
    fullMenu.appendChild(mb);
  }
}());

// Sticky CTA on mobile
(function() {
  var cta = document.createElement('div');
  cta.className = 'sticky-mobile-cta';
  cta.innerHTML = '<a href="#kontakt">M\xe1m z\xe1jem <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></a>';
  document.body.appendChild(cta);
  var shown = false;
  var kontakt = document.getElementById('kontakt');
  window.addEventListener('scroll', function() {
    var past   = window.scrollY > 500;
    var atCta  = kontakt && kontakt.getBoundingClientRect().top < window.innerHeight * 0.85;
    var should = past && !atCta;
    if (should !== shown) { shown = should; cta.classList.toggle('visible', shown); }
  }, { passive: true });
}());
