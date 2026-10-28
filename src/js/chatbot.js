// Jednoduchý chatbot se základními odpověďmi (bez AI, odpovědi podle klíčových slov)

const KB = [
  { keys: ['cen', 'kolik', 'stoj', 'cena', 'cenu', 'cenov', 'price'],
    a: 'One-page web (Web Start) je za 5 900 Kč. Vícestránkový web (Web Business) od 12 000 do 20 000 Kč dle rozsahu — cena je vždy jasná předem. Hosting je v ceně, dál platíte jen doménu ~200 Kč/rok.' },
  { keys: ['dlouho', 'trva', 'kdy', 'lhut', 'tyden', 'doba', 'rychle'],
    a: 'První náhled máte do 48 hodin od schůzky. Menší web je obvykle hotový do 7–10 dnů — záleží na rozsahu a na tom, jak rychle dodáte podklady.' },
  { keys: ['barter', 'vymeni', 'bez penez', 'vymena'],
    a: 'Barter je výměna — web za pobyt. Aktuálně hledám kemp u přehrady nebo jezera s místem pro karavan (červen–září). Kvalita webu je stejná jako u placené zakázky. Podrobnosti najdete na stránce Barter.' },
  { keys: ['funguj', 'postup', 'proces', 'jak to', 'krok', 'vyroba', 'zacin', 'spoluprac'],
    a: 'Vyplníte formulář → domluvíme se na obsahu a designu → do 48 h máte první náhled → po schválení web spustíme. Bez WordPressu, bez měsíčních poplatků.' },
  { keys: ['kontakt', 'email', 'telefon', 'napsat', 'napiss', 'zavolat', 'mail', 'spojit'],
    a: 'Napište na info@janyskovadigital.cz nebo zavolejte na +420 739 395 800. Nebo vyplňte formulář níže — ozvu se do 24 hodin.' },
  { keys: ['wordpress', 'wp', 'sablona', 'template', 'wix', 'squarespace'],
    a: 'Nepracuji s WordPressem ani šablonami — každý web je psaný v čistém kódu. Proto mají PageSpeed skóre 90–100 a neplatíte za hosting ani drahé pluginy.' },
  { keys: ['hosting', 'domena', 'domain', 'server', 'provoz', 'platit'],
    a: 'Hosting je v ceně tvorby — neplatíte nic navíc. Dál platíte jen doménu, přibližně 200 Kč ročně.' },
  { keys: ['seo', 'vyhledava', 'google', 'pozice', 'hleda', 'najde'],
    a: 'SEO je součástí každého webu — správná struktura, meta tagy, rychlost načítání, schéma dat. Součástí je i napojení na Google Search Console.' },
  { keys: ['refresh', 'predelat', 'prevest', 'existujici', 'stavajic'],
    a: 'Web Refresh je převod stávajícího webu z WordPressu na čistý kód. Jednostránkový za 8 900 Kč, vícestránkový od 14 900 Kč. Výsledek: rychlejší web bez drahého hostingu.' },
  { keys: ['sprava', 'care', 'aktualizac', 'update', 'obsah', 'zmen'],
    a: 'Web Care (správa webu) začíná od 490 Kč/měsíc — základní plán. Standard je 990 Kč/měsíc. Nebo hodinově za 850 Kč/hod. Zahrnuje aktualizace obsahu a technický dohled.' }
];

const FALLBACK = 'Tohle vám přesně neřeknu, ale ráda odpovím osobně. Napište na info@janyskovadigital.cz nebo vyplňte formulář níže — ozvu se do 24 hodin.';
const CHIPS = [
  { label: 'Kolik stojí web?',        idx: 0 },
  { label: 'Jak dlouho trvá výroba?', idx: 1 },
  { label: 'Co je barter?',           idx: 2 },
  { label: 'Jak to funguje?',         idx: 3 },
  { label: 'Jak vás kontaktovat?',    idx: 4 }
];


const toggle = document.getElementById('chat-toggle');
const panel  = document.getElementById('chat-panel');

if (toggle && panel) {
  panel.inert = true;

  const iconOpen  = document.getElementById('chat-icon-open');
  const iconClose = document.getElementById('chat-icon-close');
  const messages  = document.getElementById('chat-messages');
  const input     = document.getElementById('chat-input');
  const sendBtn   = document.getElementById('chat-send');

  function setIcons(open) {
    if (iconOpen)  iconOpen.classList.toggle('is-hidden', open);
    if (iconClose) iconClose.classList.toggle('is-hidden', !open);
  }

  function addMsg(text, type, withCTA) {
    const el = document.createElement('div');
    el.className = 'chat-bubble chat-bubble--' + type;
    el.textContent = text;
    messages.appendChild(el);
    if (withCTA) {
      const a = document.createElement('a');
      a.href = document.getElementById('kontakt') ? '#kontakt' : '/#kontakt';
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
    panel.inert = true;
    setIcons(false);
  }

  let initialized = false;
  toggle.addEventListener('click', function() {
    const open = panel.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
    panel.setAttribute('aria-hidden', !open);
    panel.inert = !open;
    setIcons(open);
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
}
