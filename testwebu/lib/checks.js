// Pravidla auditu. Každá kontrola vrací stav (pass / warn / fail / info), stručný popis zjištění,
// vysvětlení proč na tom záleží a jak to opravit — česky, pro majitele webu, ne pro programátory.

export const CATEGORIES = {
  speed: 'Rychlost',
  tech: 'Technické nastavení',
  seo: 'Obsah pro vyhledávače',
  ai: 'Údaje pro vyhledávače a AI',
  security: 'Základní zabezpečení',
  email: 'Nastavení e-mailu',
  privacy: 'Soukromí a údaje o firmě',
  a11y: 'Přístupnost',
};

// Nadpisy skupin ve výsledku: otázky, kterým rozumí i laik
export const CATEGORY_QUESTIONS = {
  speed: 'Načte se web rychle i na mobilu?',
  tech: 'Je web správně nastavený pro prohlížeče a vyhledávače?',
  seo: 'Co se vyhledávače dozvědí z obsahu webu?',
  ai: 'Jaké údaje mohou o webu přečíst vyhledávače a AI?',
  security: 'Jaké základní ochrany jsme našli?',
  email: 'Jaká pravidla má doména pro e-mail?',
  privacy: 'Jaké informace o soukromí a firmě jsou na webu?',
  a11y: 'Je web použitelný i pro lidi s omezením?',
};

const WEIGHT = { high: 3, medium: 2, low: 1 };

function check(category, id, weight, status, title, detail, why, fix) {
  // These suggestions are repairs, not maintenance advice for a passing result.
  if (status === 'pass' && ['psi-mobile', 'psi-desktop', 'lcp', 'cls', 'tbt', 'weight', 'http-redirect', 'www', '404', 'mobile', 'ttfb'].includes(id)) fix = null;
  return { category, id, weight: WEIGHT[weight], status, title, detail, why, fix };
}

// Doporučení Googlu (Lighthouse) přeložená do řeči majitele webu
const OPPORTUNITIES = {
  'legacy-javascript': { title: 'kód navíc pro staré prohlížeče',
    what: 'Web stahuje i kód pro starší prohlížeče. Část může být potřebná kvůli návštěvníkům, kteří je používají.',
    why: 'Je to zbytečná práce navíc, která hlavně levnější mobily trochu zdrží.',
    fix: 'Sestavovat skripty pro moderní prohlížeče. Často jde o kód pluginů nebo cizích služeb (měření návštěvnosti, chat). U cizích služeb nelze kód vždy upravit. Správce musí posoudit, co je skutečně potřeba.' },
  'render-blocking': { title: 'soubory, na které stránka čeká',
    what: 'Než telefon stránku ukáže, musí stáhnout soubory se vzhledem (styly) a někdy i skripty. Do té doby je obrazovka prázdná.',
    why: 'Čím víc takových souborů a čím jsou větší, tím déle návštěvník kouká na bílou obrazovku. Pár malých souborů se vzhledem má každý web.',
    fix: 'Nezbytné styly vložit přímo do stránky, ostatní skripty načítat odloženě (defer/async).' },
  'render-blocking-resources': { title: 'soubory, na které stránka čeká',
    what: 'Než telefon stránku ukáže, musí stáhnout soubory se vzhledem (styly) a někdy i skripty. Do té doby je obrazovka prázdná.',
    why: 'Čím víc takových souborů a čím jsou větší, tím déle návštěvník kouká na bílou obrazovku. Pár malých souborů se vzhledem má každý web.',
    fix: 'Nezbytné styly vložit přímo do stránky, ostatní skripty načítat odloženě (defer/async).' },
  'cache': { title: 'prohlížeč si soubory pamatuje krátce',
    what: 'Když se návštěvník na web vrátí, telefon by měl obrázky a další soubory vzít z paměti. Některé si ale smí pamatovat jen krátce, a tak je stahuje znovu.',
    why: 'Týká se jen opakovaných návštěv: web se při nich načte o něco pomaleji, než by musel.',
    fix: 'Nastavit na serveru dlouhou platnost cache (Cache-Control) pro obrázky, styly, skripty a písma. U souborů cizích služeb toto nastavení obvykle nemůžete změnit přímo.' },
  'long-cache-ttl': { title: 'prohlížeč si soubory pamatuje krátce',
    what: 'Když se návštěvník na web vrátí, telefon by měl obrázky a další soubory vzít z paměti. Některé si ale smí pamatovat jen krátce, a tak je stahuje znovu.',
    why: 'Týká se jen opakovaných návštěv: web se při nich načte o něco pomaleji, než by musel.',
    fix: 'Nastavit na serveru dlouhou platnost cache (Cache-Control) pro obrázky, styly, skripty a písma. U souborů cizích služeb toto nastavení obvykle nemůžete změnit přímo.' },
  'image-delivery': { title: 'zbytečně velké obrázky',
    what: 'Obrázky jsou větší nebo v horším formátu, než je potřeba.',
    why: 'Obrázky tvoří obvykle největší část dat stránky.',
    fix: 'Převést obrázky do WebP/AVIF, zmenšit je na zobrazovanou velikost a použít srcset pro mobil.' },
  'responsive-images': { title: 'zbytečně velké obrázky',
    what: 'Obrázky se posílají ve větším rozlišení, než v jakém se zobrazují.', why: 'Mobil stahuje zbytečná data.',
    fix: 'Připravit menší varianty obrázků (srcset).' },
  'image-formats': { title: 'obrázky ve starém formátu',
    what: 'Obrázky jsou v JPG/PNG místo moderního WebP nebo AVIF.', why: 'Moderní formát může snížit objem dat. Úspora závisí na konkrétním obrázku a nastavení kvality.',
    fix: 'Převést obrázky do WebP nebo AVIF.' },
  'offscreen-images': { title: 'obrázky mimo obrazovku se načítají hned',
    what: 'Obrázky, které návštěvník zatím nevidí, se stahují hned při otevření.', why: 'Zdržují načtení toho, co je vidět.',
    fix: 'Přidat obrázkům mimo první obrazovku loading="lazy".' },
  'unused-javascript': { title: 'nepoužívaný JavaScript',
    what: 'Stránka stahuje kód, který na ní nic nedělá, typicky z pluginů a šablon.', why: 'Návštěvník stahuje zbytečná data a telefon zbytečně pracuje.',
    fix: 'Odstranit nebo načítat jen tam, kde jsou potřeba (pluginy, slidery, chaty).' },
  'unused-css-rules': { title: 'nepoužívané styly',
    what: 'Stránka stahuje popis vzhledu (styly) i pro prvky, které na ní vůbec nejsou.', why: 'Zdržuje to první zobrazení stránky.',
    fix: 'Odstranit nepoužívané styly, u šablon vypnout nepotřebné moduly.' },
  'document-latency': { title: 'pomalé načtení samotné stránky',
    what: 'Server odpovídá pomalu, přesměrovává nebo neposílá stránku zkomprimovanou.', why: 'Na tom závisí všechno ostatní.',
    fix: 'Rychlejší hosting nebo cache stránek, komprese (gzip/brotli), odstranit zbytečná přesměrování.' },
  'text-compression': { title: 'chybí komprese',
    what: 'Server posílá soubory nezkomprimované.', why: 'Data jsou zbytečně několikanásobně větší.',
    fix: 'Zapnout na serveru kompresi gzip nebo brotli.' },
  'font-display': { title: 'písma zdržují text',
    what: 'Text se nezobrazí, dokud se nestáhne písmo.', why: 'Návštěvník chvíli vidí prázdná místa místo textu.',
    fix: 'Nastavit u písem font-display: swap a hostovat je na vlastním webu.' },
  'lcp-discovery': { title: 'hlavní obrázek se najde pozdě',
    what: 'Prohlížeč se o hlavním obrázku stránky dozví až pozdě.', why: 'Zdržuje to okamžik, kdy návštěvník uvidí hlavní obsah.',
    fix: 'Hlavní obrázek nenačítat líně (bez loading="lazy") a přidat mu fetchpriority="high".' },
  'third-parties': { title: 'cizí služby zdržují stránku',
    what: 'Chat, měření návštěvnosti, reklamy nebo vložená videa se načítají z cizích serverů a stránka na ně čeká.', why: 'Na jejich rychlost nemáte vliv a každá další služba web zpomalí.',
    fix: 'Omezit počet služeb a načítat je až po zobrazení stránky nebo po kliknutí.' },
  'dom-size': { title: 'příliš složitá stránka',
    what: 'Stránka je poskládaná z obrovského množství drobných kousků (typické pro page buildery jako Elementor).', why: 'Telefon s ní dlouho počítá a stránka pak reaguje pomaleji.',
    fix: 'Zjednodušit strukturu stránky, méně vnořených bloků.' },
  'network-dependency-tree': { title: 'řetězení načítání',
    what: 'Telefon zjistí, co má stáhnout, až postupně: soubor po souboru, jako když čekáte ve frontě.', why: 'Každý krok čeká na ten předchozí, takže se zdržení sčítá.',
    fix: 'Důležité soubory (písma, hlavní styly) načítat dopředu pomocí preload/preconnect.' },
};

// Co úspora znamená pro skutečného návštěvníka (odhad Googlu je pro pomalý mobil)
function visitorImpact(ms, speedScore) {
  if (ms < 300 || (speedScore >= 90 && ms < 1000)) return 'Odhadovaná úspora je malá. Jde spíše o doladění než zásadní problém.';
  return `Google odhaduje možnou úsporu ${fmtMs(ms)}. Skutečný přínos závisí na konkrétní úpravě a zařízení návštěvníka.`;
}

const fmtMs = ms => (ms >= 1000 ? `${(ms / 1000).toFixed(1).replace('.', ',')} s` : `${Math.round(ms)} ms`);
const plural = (n, one, few, many) => `${n} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`;

// ── Rychlost (PageSpeed) ─────────────────────────────────────────────────────

export function speedChecks(strategy, psi) {
  const label = strategy === 'mobile' ? 'mobilu' : 'počítači';
  if (!psi || psi.error || psi.scores.performance == null) {
    return [check('speed', `psi-${strategy}`, 'high', 'info', `Rychlost na ${label} se nepodařilo změřit`, psi?.error || 'Měření se nepodařilo.',
      'Rychlost měří Google stejným nástrojem jako PageSpeed Insights.', 'Zkuste test spustit znovu za chvíli.')];
  }
  const out = [];
  const s = psi.scores.performance;
  out.push(check('speed', `psi-${strategy}`, 'high', s >= 90 ? 'pass' : s >= 50 ? 'warn' : 'fail',
    `Skóre rychlosti na ${label}: ${s}/100`,
    s >= 90 ? 'V tomto měření se web načetl rychle.' : s >= 50 ? 'Načítání má prostor ke zlepšení, hlavně na pomalejším připojení.' : 'V tomto měření se web načítal pomalu. Delší čekání může návštěvníky odradit.',
    'Rychlý web se příjemněji používá. Jedno měření ale neurčuje počet zákazníků ani pořadí v Googlu.',
    'Zmenšit a převést obrázky do WebP, omezit skripty třetích stran, zvážit lehčí řešení než těžkou šablonu.'));

  if (strategy === 'mobile') {
    const lcp = psi.metrics.lcp?.value;
    if (lcp != null) out.push(check('speed', 'lcp', 'high', lcp <= 2500 ? 'pass' : lcp <= 4000 ? 'warn' : 'fail',
      `Největší viditelný prvek se zobrazil za ${fmtMs(lcp)}`, 'Jde o měření Googlu na napodobeném mobilu. Doporučená hodnota je nejvýše 2,5 s.',
      'Měří se zobrazení největšího viditelného obrázku nebo bloku textu. Nejde o čas načtení celého webu.',
      'Požádejte správce webu, aby prověřil hlavní obrázek, písma a soubory potřebné pro první zobrazení stránky.'));
    const cls = psi.metrics.cls?.value;
    if (cls != null) out.push(check('speed', 'cls', 'medium', cls <= 0.1 ? 'pass' : cls <= 0.25 ? 'warn' : 'fail',
      `Posouvání obsahu při načítání: ${cls.toFixed(2).replace('.', ',')}`, 'Číslo ukazuje, jak moc se obsah během načítání posouvá. Čím méně, tím lépe; dobrá hodnota je nejvýše 0,1.',
      'Když obrázek nebo tlačítko náhle změní polohu, může návštěvník omylem klepnout jinam.',
      'Doplnit obrázkům rozměry, rezervovat místo pro reklamy a vložené prvky, načítat písma správně.'));
    const tbt = psi.metrics.tbt?.value;
    if (tbt != null) out.push(check('speed', 'tbt', 'medium', tbt <= 200 ? 'pass' : tbt <= 600 ? 'warn' : 'fail',
      `Zdržení reakcí při načítání: ${fmtMs(tbt)}`, 'Součet delších okamžiků, kdy prohlížeč zpracovával kód a nemohl pohotově reagovat.',
      'Může vysvětlovat pomalé reakce při načítání. Nejde o přímé měření všech kliknutí skutečných návštěvníků.',
      'Omezit nebo odložit skripty (chaty, měření, pluginy), které stránka nepotřebuje hned.'));
    if (psi.field?.overall) {
      const st = { FAST: 'pass', AVERAGE: 'warn', SLOW: 'fail' }[psi.field.overall] || 'info';
      const parts = [];
      if (psi.field.lcp) parts.push(`zobrazení hlavního prvku ${fmtMs(psi.field.lcp.p75)}`);
      if (psi.field.inp) parts.push(`reakce na ovládání ${fmtMs(psi.field.inp.p75)}`);
      if (psi.field.cls) parts.push(`posouvání obsahu ${(psi.field.cls.p75 / 100).toFixed(2).replace('.', ',')}`);
      out.push(check('speed', 'field', 'high', st,
        st === 'pass' ? 'Skuteční návštěvníci: web je rychlý' : st === 'warn' ? 'Skuteční návštěvníci: web je průměrný' : 'Skuteční návštěvníci: web je pomalý',
        `Data z prohlížečů Chrome za posledních 28 dní${psi.field.scope === 'origin' ? ' (za celý web)' : ''}: ${parts.join(', ')}.`,
        'Jde o souhrn zkušeností návštěvníků používajících Chrome, nikoli o právě spuštěné měření. Nezahrnuje všechny lidi ani všechny prohlížeče.',
        st === 'pass' ? 'Nic, jen to udržet.' : 'Zaměřit se na metriku, která je nejhorší (viz doporučení níže).'));
    } else {
      out.push(check('speed', 'field', 'high', 'info', 'Google zatím nemá data od skutečných návštěvníků',
        'Google pro tuto stránku nebo doménu neposkytl dostatek údajů z běžného provozu. Samo o sobě to není chyba webu.',
        'U menších a nových webů je to běžné. Pro orientaci můžete použít samostatné měření rychlosti výše.', '—'));
    }
    if (psi.bytes) {
      const mb = psi.bytes / 1048576;
      out.push(check('speed', 'weight', 'medium', mb <= 1.5 ? 'pass' : mb <= 3 ? 'warn' : 'fail',
        `Velikost stránky: ${mb.toFixed(1).replace('.', ',')} MB`, 'Objem dat stažených při tomto měření stránky.',
        'Větší objem dat může prodloužit načítání a spotřebuje více mobilních dat. Hranice 1,5 MB je orientační doporučení tohoto testu.',
        'Zmenšit obrázky (WebP, správné rozměry), odstranit nepoužívané skripty, písma a pluginy.'));
    }
    for (const o of psi.opportunities || []) {
      const t = OPPORTUNITIES[o.id] || OPPORTUNITIES[o.id.replace(/^(uses-|modern-)/, '')];
      out.push(check('speed', `opp-${o.id}`, 'low', 'info',
        `Tip na zrychlení: ${t?.title || o.title} (odhad úspory ${fmtMs(o.savingsMs)})`,
        `${t?.what || `Doporučení Googlu: ${o.title}.`} ${visitorImpact(o.savingsMs, s)}`,
        t?.why || 'Google odhaduje, o kolik by se načítání zrychlilo po opravě.',
        t?.fix || 'Podrobnosti ukáže PageSpeed Insights (pagespeed.web.dev) u této položky.'));
    }
  }
  return out;
}

// Doporučené postupy a SEO podle Lighthouse (jen z mobilního měření, aby se neopakovaly)
export function lighthouseChecks(psi) {
  if (!psi || psi.error) return [];
  const out = [];
  const bp = psi.scores.bestPractices;
  if (bp != null) out.push(check('security', 'best-practices', 'medium', bp >= 90 ? 'pass' : bp >= 70 ? 'warn' : 'fail',
    `Základní kontrola podle Googlu: ${bp}/100`,
    psi.failedBestPractices.length ? `Nedostatky: ${psi.failedBestPractices.slice(0, 5).join(' · ')}` : 'V této skupině automatický test nenašel nedostatky.',
    'Kontrola hledá například problémy se zabezpečeným připojením, zastaralým kódem nebo obrázky. Nenahrazuje bezpečnostní audit.', psi.failedBestPractices.length ? 'Předejte uvedené body správci webu k posouzení.' : null));
  const seo = psi.scores.seo;
  if (seo != null) out.push(check('seo', 'lighthouse-seo', 'medium', seo >= 90 ? 'pass' : seo >= 70 ? 'warn' : 'fail',
    `SEO podle Google Lighthouse: ${seo}/100`,
    psi.failedSeo.length ? `Nedostatky: ${psi.failedSeo.slice(0, 5).join(' · ')}` : 'Základní technické SEO je v pořádku.',
    'Ověřuje základní nastavení pro vyhledávače, například titulky a dostupnost obsahu. Neříká, na jakém místě se web objeví ve výsledcích.', psi.failedSeo.length ? 'Opravit uvedené nedostatky.' : '—'));
  return out;
}

export function a11yChecks(psi) {
  if (!psi || psi.error || psi.scores.accessibility == null) return [];
  const s = psi.scores.accessibility;
  return [check('a11y', 'a11y-score', 'medium', s >= 90 ? 'pass' : s >= 70 ? 'warn' : 'fail',
    `Přístupnost: ${s}/100`,
    psi.failedAccessibility.length ? `Kontrola našla tyto nedostatky: ${psi.failedAccessibility.slice(0, 5).join(' · ')}` : 'Automatická kontrola nenašla chyby v bodech, které dokáže ověřit.',
    'Přístupný web se lépe používá i lidem se zrakovým nebo pohybovým omezením. Některé věci musí vyzkoušet člověk, například ovládání klávesnicí nebo čtečkou obrazovky. Ani 100/100 proto není úplné posouzení přístupnosti.',
    psi.failedAccessibility.length ? 'Předejte uvedené nedostatky správci webu. Podle nálezu může být potřeba zlepšit čitelnost textu, popisky nebo ovládání.' : null)];
}

// ── Technika, SEO, AI, bezpečnost, GDPR ─────────────────────────────────────

export function formAntispamChecks(p) {
  if (!p.forms) return [];
  const a = p.formAntispam || { recognizedForms: 0, methods: [] };
  return [check('security', 'form-antispam', 'low', 'info',
    a.recognizedForms ? 'Ve formulářích jsou známky antispamové ochrany' : 'Antispam formulářů nebyl v HTML rozpoznán',
    a.recognizedForms
      ? `Rozpoznáno: ${a.methods.join(', ')}. Známky ochrany u ${a.recognizedForms} z ${p.forms} formulářů v načteném HTML. To nepotvrzuje ochranu všech formulářů ani její funkčnost.`
      : 'Ochrana může být načítána JavaScriptem nebo fungovat pouze na serveru. Její nepřítomnost nelze z tohoto výsledku vyvodit.',
    'Test se dívá pouze do kódu stránky. Formuláře neodesílá, takže nedokáže potvrdit, zda ochrana proti spamu skutečně funguje. Tento údaj nemění skóre.',
    'Požádejte správce webu, aby ověřil odmítání neověřených zpráv a příliš častého odesílání. Samotné zobrazené políčko ochrany nestačí.')];
}

export function siteChecks(r) {
  const out = [];
  const p = r.page;
  const url = new URL(r.finalUrl);

  // Technika a indexace
  out.push(url.protocol === 'https:'
    ? check('tech', 'https', 'high', 'pass', 'Web běží na zabezpečeném HTTPS', 'Spojení je šifrované.', 'HTTPS šifruje spojení mezi návštěvníkem a webem. Samotné šifrování ale nezaručuje bezpečnost celého webu.', '—')
    : check('tech', 'https', 'high', 'fail', 'Web neběží na HTTPS', 'Stránka se načítá přes nešifrované http://.', 'Prohlížeč web označí jako „Nezabezpečený“, formuláře posílají data bez šifrování a Google web znevýhodní.', 'Zapnout SSL certifikát (u většiny hostingů zdarma přes Let’s Encrypt) a přesměrovat vše na https.'));

  if (r.httpRedirect) {
    const h = r.httpRedirect;
    const st = h.toHttps ? (h.permanent ? 'pass' : 'warn') : 'fail';
    out.push(check('tech', 'http-redirect', 'high', st,
      st === 'pass' ? 'Verze http:// přesměrovává na https://' : st === 'warn' ? 'Přesměrování na https:// je jen dočasné' : 'Verze http:// nepřesměrovává na https://',
      st === 'pass' ? 'Trvalým přesměrováním 301/308.' : st === 'warn' ? 'Používá se dočasné přesměrování (302/307).' : 'Web jde otevřít i nezabezpečeně.',
      'Přesměrování pošle návštěvníka na šifrovanou verzi webu a sjednotí jeho adresu.',
      'Nastavit trvalé přesměrování 301 z http na https (u hostingu nebo v .htaccess).'));
  }

  if (r.wwwCheck) {
    out.push(check('tech', 'www', 'medium', r.wwwCheck.consistent ? 'pass' : 'warn',
      r.wwwCheck.consistent ? 'Verze s www i bez www vedou na stejnou adresu' : 'Web jde otevřít s www i bez www zvlášť',
      r.wwwCheck.consistent ? 'Jedna z variant přesměrovává na druhou.' : `${r.wwwCheck.other} se načte bez přesměrování.`,
      'Jedna hlavní adresa pomáhá předejít zmatkům, když lze stejný web otevřít s www i bez něj.',
      'Zvolit jednu variantu a druhou na ni trvale přesměrovat.'));
  }

  const hops = r.chain.length;
  if (hops > 1) out.push(check('tech', 'redirect-chain', 'low', 'warn', `Řetěz ${plural(hops, 'přesměrování', 'přesměrování', 'přesměrování')} před načtením`,
    r.chain.map(c => `${c.status} ${c.url}`).join(' → '), 'Každý další krok přesměrování může prodloužit načítání.', 'Odkazovat a přesměrovávat rovnou na konečnou adresu.'));

  const noindex = /noindex/i.test(p.robots || '') || /noindex/i.test(r.headers['x-robots-tag'] || '');
  out.push(noindex
    ? check('tech', 'noindex', 'high', 'fail', 'Úvodní stránka je skrytá před Googlem (noindex)', 'Stránka obsahuje pokyn „noindex“.', 'Google ji nezobrazí ve výsledcích vyhledávání.', 'Odstranit noindex (u WordPressu: Nastavení → Zobrazování → „Požádat vyhledávače…“ odškrtnout).')
    : check('tech', 'noindex', 'high', 'pass', 'Úvodní stránka smí do vyhledávání', 'Žádný zákaz indexace.', 'Google může stránku zobrazit ve výsledcích.', '—'));

  if (r.robots.searchBlocked.length && !r.robots.blocksAll) out.push(check('tech', 'search-bots', 'high', 'fail',
    `Robots.txt blokuje vyhledávač: ${r.robots.searchBlocked.join(', ')}`,
    'Tento vyhledávač nesmí web procházet.', r.robots.searchBlocked.includes('SeznamBot')
      ? 'Seznam má podle těchto pravidel zakázáno web procházet. To může omezit získávání a aktualizaci jeho obsahu.' : 'Tento vyhledávač má podle pravidel zakázáno web procházet. Samotný zákaz ale neprokazuje, že ve výsledcích není žádná jeho adresa.',
    'Odstranit zákaz (Disallow: /) pro tento vyhledávač z robots.txt.'));

  if (r.robots.unavailable) out.push(check('tech', 'robots', 'low', 'info', 'Robots.txt se nepodařilo ověřit', 'Server odmítl požadavek nebo neodpověděl.', 'Neověřený výsledek není důkaz chybějícího souboru ani povoleného přístupu.', 'Ověřit robots.txt ručně nebo test zopakovat.'));
  else if (!r.robots.exists) out.push(check('tech', 'robots', 'low', 'info', 'Robots.txt nebyl nalezen', `${url.origin}/robots.txt`, 'Bez robots.txt může vyhledávač web běžně procházet. Soubor slouží k pravidlům procházení a odkazu na sitemapu.', 'Pokud chcete omezit přístup některých robotů, požádejte správce webu o doplnění pravidel do robots.txt. Jinak není nutné tento soubor doplňovat jen kvůli testu.'));
  else if (r.robots.blocksAll) out.push(check('tech', 'robots', 'high', 'fail', 'Robots.txt blokuje celý web', 'Obsahuje „Disallow: /“ pro všechny roboty.', 'Vyhledávače nesmí web procházet. Většinou zapomenuté nastavení z vývoje.', 'Odstranit „Disallow: /“ z robots.txt.'));
  else if (!r.robots.searchBlocked.length) out.push(check('tech', 'robots', 'low', 'pass', 'Soubor robots.txt je v pořádku', 'Existuje a neblokuje celý web.', 'Vyhledávače vědí, co smí procházet.', '—'));

  out.push(r.sitemap.unavailable
    ? check('tech', 'sitemap', 'medium', 'info', 'Mapu webu se nepodařilo ověřit', 'Nebylo možné dokončit stažení v rámci této kontroly.', 'Neověřená mapa není důkaz chybějícího souboru.', 'Ověřit adresu sitemapy ručně nebo test zopakovat.')
    : r.sitemap.urls > 0
    ? check('tech', 'sitemap', 'medium', 'pass', `Mapa webu (sitemap) obsahuje ${plural(r.sitemap.urls, 'stránku', 'stránky', 'stránek')}`, r.sitemap.url, 'Pomáhá Googlu najít všechny stránky, hlavně nové.', r.robots.sitemap ? '—' : 'Doplnit odkaz na sitemap do robots.txt.')
    : check('tech', 'sitemap', 'medium', 'warn', 'Mapa webu (sitemap.xml) nebyla nalezena', 'Není na obvyklé adrese ani v robots.txt.', 'Mapa webu pomáhá vyhledávačům objevovat stránky. I bez ní ale mohou stránky najít pomocí odkazů.', 'Vytvořit sitemap.xml, odkázat ji v robots.txt a odeslat v Google Search Console.'));

  if (!p.canonical) out.push(check('tech', 'canonical', 'medium', 'warn', 'Chybí určení hlavní adresy stránky (canonical)', 'Stránka neurčuje svou hlavní adresu.', 'Pokud má stejný obsah více adres, toto nastavení vyhledávači doporučí tu hlavní.', 'Doplnit <link rel="canonical"> s hlavní adresou stránky.'));
  else {
    const same = p.canonical.replace(/\/$/, '') === r.finalUrl.replace(/\/$/, '');
    out.push(check('tech', 'canonical', 'medium', same ? 'pass' : 'warn', same ? 'Uvedená hlavní adresa odpovídá otevřené stránce' : 'Jako hlavní je uvedená jiná adresa',
      same ? p.canonical : `Stránka ${r.finalUrl} uvádí jako hlavní ${p.canonical}.`, 'Říká Googlu, kterou adresu stránky zobrazovat.', same ? '—' : 'Ověřit, že canonical odkazuje sám na sebe (pokud to není záměr).'));
  }

  if (r.notFound && !r.notFound.status) out.push(check('tech', '404', 'medium', 'info', 'Chování neexistující stránky se nepodařilo ověřit', r.notFound.url, 'Server neodpověděl v rámci kontroly.', 'Zopakovat test nebo otevřít neexistující adresu ručně.'));
  else if (r.notFound) out.push(check('tech', '404', 'medium', r.notFound.status === 404 || r.notFound.status === 410 ? 'pass' : 'warn',
    r.notFound.status === 404 || r.notFound.status === 410 ? 'Neexistující stránky vracejí chybu 404' : `Neexistující stránka vrací kód ${r.notFound.status || 'chybu'} místo 404`,
    `Testovací adresa: ${r.notFound.url}`, 'Odpověď má prohlížeči a vyhledávači říct, že stránka neexistuje. Jinak ji mohou omylem považovat za běžnou stránku.', 'Nastavit vracení stavového kódu 404 a vlastní chybovou stránku s odkazy dál.'));

  out.push(check('tech', 'mobile', 'high', p.viewport && /width\s*=\s*device-width/i.test(p.viewport) ? 'pass' : 'fail',
    p.viewport && /width\s*=\s*device-width/i.test(p.viewport) ? 'Stránka má nastavené přizpůsobení šířce mobilu' : 'Chybí nastavení šířky stránky pro mobil', p.viewport ? `viewport: ${p.viewport}` : 'Chybí značka viewport.',
    'Toto nastavení umožňuje přizpůsobit stránku mobilní obrazovce. Samo ještě nepotvrzuje, že se na mobilu vše dobře ovládá.', 'Doplnit <meta name="viewport" content="width=device-width, initial-scale=1"> a responzivní design.'));

  if (!p.lang) out.push(check('tech', 'lang', 'low', 'warn', 'Není uvedený jazyk stránky', 'Chybí atribut lang u <html>.', 'Pomáhá vyhledávačům, překladačům a čtečkám obrazovky.', 'Doplnit <html lang="cs">.'));

  if (p.mixedContent.length) out.push(check('security', 'mixed', 'medium', 'fail', `${plural(p.mixedContent.length, 'soubor se načítá', 'soubory se načítají', 'souborů se načítá')} nezabezpečeně`,
    p.mixedContent.slice(0, 3).join(', '), 'Na HTTPS stránce prohlížeč takové soubory blokuje nebo varuje.', 'Změnit adresy souborů na https://.'));

  if (r.ttfb != null) out.push(check('speed', 'ttfb', 'medium', r.ttfb <= 800 ? 'pass' : r.ttfb <= 1800 ? 'warn' : 'fail',
    `Odezva serveru: ${fmtMs(r.ttfb)}`, 'Čas do stažení HTML stránky z našeho serveru.', 'Delší čekání na odpověď serveru může zpomalit načtení. Z tohoto údaje samotného nelze určit příčinu.', 'Požádejte správce webu o prověření odezvy serveru a ukládání hotových stránek pro rychlejší načítání.'));

  // Obsah a SEO
  const t = p.title || '';
  out.push(!t ? check('seo', 'title', 'high', 'fail', 'Chybí titulek stránky', 'Stránka nemá <title>.', 'Výstižný titulek pomáhá návštěvníkům poznat obsah výsledku.', 'Doplnit titulek podle skutečného obsahu stránky.')
    : check('seo', 'title', 'high', 'pass', `Titulek: „${t.slice(0, 80)}${t.length > 80 ? '…' : ''}“`,
      `${plural(t.length, 'znak', 'znaky', 'znaků')}.`,
      'Kontrola ověřuje přítomnost titulku. Výstižnost nelze rozhodnout jen podle počtu znaků. Google může titulek změnit.', 'Ověřit, že titulek jasně popisuje nabídku a odlišuje stránku od ostatních.'));

  const d = p.description || '';
  out.push(!d ? check('seo', 'description', 'medium', 'warn', 'Chybí popis stránky (meta description)', 'Google může úryvek vybrat z obsahu.', 'Vlastní popis umožňuje stručně představit stránku; jeho použití ve výsledcích není zaručeno.', 'Doplnit konkrétní a výstižný popis stránky.')
    : check('seo', 'description', 'medium', 'pass', 'Popis stránky (meta description)', `${plural(d.length, 'znak', 'znaky', 'znaků')}: „${d.slice(0, 160)}${d.length > 160 ? '…' : ''}“`,
      'Kontrola potvrzuje přítomnost. Počet znaků sám o sobě neurčuje kvalitu a Google může zobrazit jiný úryvek.', 'Ověřit shodu popisu s obsahem a nabídkou.'));

  const h1 = p.headings.filter(h => h.level === 1);
  out.push(check('seo', 'h1', 'medium', h1.length === 1 ? 'pass' : h1.length === 0 ? 'fail' : 'warn',
    h1.length === 1 ? 'Stránka má jeden hlavní nadpis (H1)' : h1.length === 0 ? 'Chybí hlavní nadpis (H1)' : `Stránka má ${h1.length} hlavních nadpisů (H1)`,
    h1.map(h => `„${h.text}“`).slice(0, 3).join(', ') || 'Stránka nemá žádný nadpis H1.',
    'Hlavní nadpis říká Googlu, AI i návštěvníkovi, o čem stránka je.', h1.length === 1 ? '—' : 'Mít na stránce právě jeden H1 s hlavním tématem.'));

  const skips = p.headings.filter((h, i) => i > 0 && h.level > p.headings[i - 1].level + 1).length;
  if (skips) out.push(check('seo', 'heading-order', 'low', 'warn', 'Nadpisy přeskakují úrovně', `${plural(skips, 'místo', 'místa', 'míst')}, kde např. po H1 následuje rovnou H3.`, 'Logická osnova nadpisů pomáhá vyhledávačům, AI i čtečkám obrazovky.', 'Řadit nadpisy H1 → H2 → H3 bez přeskakování.'));

  const noAlt = p.images.filter(i => !i.hasAlt).length;
  if (p.images.length) out.push(check('seo', 'alt', 'medium', noAlt === 0 ? 'pass' : 'warn',
    noAlt === 0 ? 'Všechny obrázky mají popisek (alt)' : `${plural(noAlt, 'obrázek nemá', 'obrázky nemají', 'obrázků nemá')} popisek (alt)`,
    `Celkem obrázků: ${p.images.length}.`, 'Popisek čte Google (vyhledávání obrázků) i nevidomí uživatelé.', noAlt ? 'Doplnit krátký popis, co je na obrázku. Dekorativní obrázky alt="".' : '—'));

  const noSize = p.images.filter(i => !i.hasSize).length;
  if (p.images.length && noSize) out.push(check('speed', 'img-size', 'low', 'warn', `${plural(noSize, 'obrázek nemá', 'obrázky nemají', 'obrázků nemá')} zadané rozměry`, 'Chybí atributy width a height.', 'Uvedené rozměry pomáhají prohlížeči předem vyhradit místo pro obrázek a omezit posouvání obsahu.', 'Doplnit width a height podle skutečného poměru stran.'));

  const og = p.og;
  out.push(check('seo', 'og', 'low', og.title && og.image ? 'pass' : 'warn',
    og.title && og.image ? 'Náhled pro sociální sítě je nastavený' : 'Chybí náhled pro sociální sítě (Open Graph)',
    og.title && og.image ? `Obrázek: ${og.image}` : 'Při sdílení odkazu nemusí být předem zvolený obrázek a titulek.',
    'Nastavený obrázek a titulek pomáhají lidem poznat, co otevřou po kliknutí na sdílený odkaz.', og.title && og.image ? '—' : 'Doplnit og:title, og:description a og:image (1200 × 630 px).'));

  if (p.words < 200) out.push(check('seo', 'thin', 'medium', 'info', `Na stránce je kratší text (${p.words} slov)`, 'Vyhledávače a AI potřebují text, aby pochopily, co nabízíte.', 'Krátký text nemusí být chyba. Důležité je, aby návštěvník poznal, co nabízíte, komu a jak se s vámi spojí.', 'Popsat služby, pro koho jsou, kde působíte, ceny, časté otázky.'));

  if (r.pages.length) {
    const dupTitles = dupes(r.pages.map(x => x.title).concat(p.title));
    const analyzed = r.pages.filter(x => x.analyzed !== false);
    const noDesc = analyzed.filter(x => !x.description).length;
    const badH1 = analyzed.filter(x => x.h1 !== 1).length;
    const unverified = r.pages.filter(x => x.analyzed === false).length;
    const broken = r.pages.filter(x => x.status >= 400);
    const issues = [];
    if (dupTitles) issues.push(`${plural(dupTitles, 'duplicitní titulek', 'duplicitní titulky', 'duplicitních titulků')}`);
    if (noDesc) issues.push(`${noDesc}× chybí popis`);
    if (badH1) issues.push(`${badH1}× chybí nebo je víc H1`);
    if (broken.length) issues.push(`${broken.length}× chyba ${broken.map(b => b.status).join(', ')}`);
    if (unverified) issues.push(`${unverified}× obsah se nepodařilo vyhodnotit`);
    out.push(check('seo', 'subpages', 'medium', !analyzed.length && !broken.length ? 'info' : issues.length ? 'warn' : 'pass',
      `Kontrola ${plural(r.pages.length, 'další stránky', 'dalších stránek', 'dalších stránek')}`,
      (issues.length ? issues.join(' · ') + '.' : 'Titulky, popisy a nadpisy jsou v pořádku.') +
        ` Stránky: ${r.pages.map(x => { try { return decodeURI(new URL(x.url).pathname); } catch { return x.url; } }).join(', ')}`,
      'Každá stránka by měla mít vlastní titulek, popis a jeden H1, aby mohla samostatně soutěžit ve vyhledávání.',
      issues.length ? 'Projít uvedené stránky a doplnit unikátní titulky a popisy.' : '—'));
  }

  if (r.links?.unverified) out.push(check('seo', 'links-unverified', 'low', 'info', 'Některé odkazy se nepodařilo ověřit', `Bez odpovědi: ${r.links.unverified}.`, 'Timeout nebo limit kontroly neznamená, že je odkaz nefunkční.', 'Otevřít tyto odkazy ručně nebo kontrolu zopakovat.'));
  if (r.links && (r.links.checked || r.links.broken.length)) out.push(r.links.broken.length
    ? check('seo', 'broken-links', 'medium', 'fail', `${plural(r.links.broken.length, 'nefunkční odkaz', 'nefunkční odkazy', 'nefunkčních odkazů')} na úvodní stránce`,
      r.links.broken.slice(0, 5).map(l => `${l.status} ${decodeSafe(l.url)}`).join(' · '),
      'Odkaz na neexistující stránku zklame návštěvníka a Googlu říká, že web není udržovaný.', 'Opravit nebo odstranit odkazy, případně přesměrovat staré adresy na nové.')
    : check('seo', 'broken-links', 'medium', 'pass', 'V ověřeném vzorku nejsou chybové odpovědi odkazů', `Počet zkontrolovaných interních odkazů: ${r.links.checked}.`, 'Kontrola vzorku nenahrazuje ověření všech odkazů webu.', '—'));

  if (!p.favicon) out.push(check('seo', 'favicon', 'low', 'warn', 'Chybí ikona webu (favicon)', 'Stránka neodkazuje na ikonu.',
    'Ikona se zobrazuje v záložce prohlížeče a vedle odkazu ve výsledcích Googlu na mobilu.', 'Doplnit <link rel="icon"> s ikonou aspoň 48 × 48 px.'));

  // Strukturovaná data a AI vyhledávače
  const valid = p.jsonLd.filter(j => j.valid);
  const types = [...new Set(valid.flatMap(j => j.types))];
  if (p.jsonLd.some(j => !j.valid)) out.push(check('ai', 'schema-invalid', 'high', 'fail', 'Strukturovaná data obsahují chybu', 'Doplňující údaje pro vyhledávače jsou zapsané ve formátu JSON-LD s chybou.', 'Chyba zápisu může zabránit nástrojům tato doplňující data přečíst.', 'Opravit JSON-LD a ověřit v nástroji Test rozšířených výsledků od Googlu.'));
  if (valid.length || !p.jsonLd.length) out.push(valid.length
    ? check('ai', 'schema', 'high', 'pass', 'Doplňující údaje pro vyhledávače lze přečíst', `Typy: ${types.slice(0, 10).join(', ')}`, 'Test dokázal data přečíst. Neověřil ale, zda jsou všechny údaje správné a odpovídají skutečnému obsahu stránky.', '—')
    : check('ai', 'schema', 'high', 'warn', 'Chybí strukturovaná data (schema.org)', 'Na úvodní stránce nejsou žádná data JSON-LD.', 'Bez nich Google i AI odpovědi (ChatGPT, Google AI přehledy) hůř chápou, kdo jste, kde působíte a co nabízíte.', 'Doplnit LocalBusiness/Organization s adresou, telefonem a službami, u článků Article, u otázek FAQPage.'));
  const business = types.some(t => /LocalBusiness|Organization|ProfessionalService|Store|Restaurant|Corporation|Person/.test(t));
  if (valid.length && !business) out.push(check('ai', 'schema-business', 'medium', 'warn', 'Strukturovaná data neobsahují údaje o firmě', 'Chybí typ Organization nebo LocalBusiness.', 'U firemního webu mohou tyto údaje pomoci nástrojům poznat provozovatele a nabídku. Nejde o potvrzení ani podmínku zobrazení v Mapách Google.', 'Doplnit Organization/LocalBusiness s názvem, adresou, kontaktem a IČO.'));

  const blocked = r.robots.aiBlocked;
  out.push(r.robots.unavailable
    ? check('ai', 'ai-bots', 'medium', 'info', 'Pravidla pro AI vyhledávače nebyla ověřena', 'Robots.txt není dostupný pro kontrolu.', 'Z neověřeného souboru nelze určit zákaz procházení.', 'Ověřit robots.txt ručně.')
    : blocked.length
      ? check('ai', 'ai-bots', 'medium', 'info', `Zákaz procházení pro: ${blocked.join(', ')}`, 'Nalezeno pravidlo pro kořenovou cestu /.', 'Zákaz může být záměrný. Ovlivňuje procházení tímto robotem, neprokazuje úplnou nepřítomnost webu v AI odpovědích.', 'Pokud chcete danému robotu přístup umožnit, prověřit pravidla robots.txt.')
      : check('ai', 'ai-bots', 'medium', 'info', 'V základních pravidlech není zákaz pro AI vyhledávače', 'Kontrolovány OAI-SearchBot, Claude-SearchBot a PerplexityBot.', 'Pravidla jednotlivých podstránek a blokace na serveru se mohou lišit. Povolení procházení nezaručuje citaci.', '—'));
  if (r.robots.trainingBlocked?.length) out.push(check('ai', 'ai-training', 'low', 'info', 'Web omezuje roboty pro trénování AI', r.robots.trainingBlocked.join(', '), 'Pravidla pro trénování jsou odlišná od vyhledávání. Jejich blokování samo o sobě není SEO chyba.', 'Měnit jen podle toho, jak chcete svůj obsah zpřístupnit.'));

  out.push(r.llms
    ? check('ai', 'llms', 'low', 'info', 'Web má soubor llms.txt', 'Volitelný přehled obsahu.', 'Jde o návrh formátu. Jeho přítomnost neprokazuje použití AI službami ani lepší viditelnost.', '—')
    : check('ai', 'llms', 'low', 'info', 'Web nemá soubor llms.txt', 'Volitelný soubor, bez vlivu na skóre.', 'Není podmínkou indexace ani AI funkcí Googlu.', 'Není nutné jej doplňovat kvůli výsledku tohoto testu.'));

  out.push(p.phone || p.email
    ? check('ai', 'contact', 'medium', 'pass', 'Kontakt je vidět přímo na stránce', [p.phone && 'telefon', p.email && 'e-mail'].filter(Boolean).join(' a ') + ' v textu stránky.', 'Návštěvník snadno zjistí, jak se s vámi spojit. Tento bod neověřuje, jestli telefon nebo e-mail skutečně funguje.', '—')
    : check('ai', 'contact', 'medium', 'warn', 'Na úvodní stránce není vidět telefon ani e-mail', 'Kontakt je jen ve formuláři nebo na jiné stránce.', 'Zákazníci i Google hodnotí, jestli je za webem dohledatelná firma.', 'Uvést telefon a e-mail v patičce každé stránky.'));

  // Bezpečnost
  const h = r.headers;
  const sec = [
    ['strict-transport-security', 'HSTS (vynucení HTTPS)'],
    ['content-security-policy', 'Content-Security-Policy'],
    ['x-content-type-options', 'X-Content-Type-Options'],
    ['referrer-policy', 'Referrer-Policy'],
  ];
  const hasFrame = h['x-frame-options'] || /frame-ancestors/i.test(h['content-security-policy'] || '');
  const missing = sec.filter(([k]) => !h[k]).map(([, n]) => n).concat(hasFrame ? [] : ['ochrana proti vložení do rámu (X-Frame-Options)']);
  out.push(check('security', 'headers', 'medium', missing.length === 0 ? 'pass' : missing.length <= 2 ? 'warn' : 'fail',
    missing.length ? `Chybí ${plural(missing.length, 'bezpečnostní hlavička', 'bezpečnostní hlavičky', 'bezpečnostních hlaviček')}` : 'Bezpečnostní hlavičky jsou nastavené',
    missing.length ? missing.join(', ') : 'HSTS, CSP, X-Content-Type-Options, Referrer-Policy i ochrana rámů.',
    'Hlavičky jsou pokyny, které server posílá prohlížeči. Test zjistil, které jsou přítomné; neprověřil celé zabezpečení webu ani účinnost každého nastavení.',
    missing.length ? 'Doplnit hlavičky na serveru (hosting, .htaccess nebo Cloudflare).' : '—'));

  const leak = [h['x-powered-by'], h['server']].filter(v => v && /\d/.test(v));
  if (leak.length) out.push(check('security', 'version-leak', 'low', 'warn', 'Server prozrazuje verzi softwaru', leak.join(', '), 'Útočník podle verze snadno najde známé zranitelnosti.', 'Skrýt verze v hlavičkách Server a X-Powered-By.'));

  if (r.platforms.includes('WordPress')) out.push(check('security', 'wordpress', 'low', 'info', 'Web běží na WordPressu', p.generator || 'Rozpoznáno podle souborů webu.', 'Bezpečnost závisí také na aktualizacích WordPressu, šablony a doplňků. Samotné použití WordPressu není chyba.', 'Aktualizovat jádro, šablonu i pluginy, odstranit nepoužívané pluginy, zálohovat.'));

  out.push(...formAntispamChecks(p));

  // GDPR a důvěryhodnost
  out.push(p.ico
    ? check('privacy', 'ico', 'medium', 'pass', 'Na webu je uvedené IČO', 'Údaje o podnikateli jsou dohledatelné.', 'U firemního webu pomáhá IČO určit provozovatele. Jeho nalezení ale nepotvrzuje správnost ani úplnost všech firemních údajů.', '—')
    : check('privacy', 'ico', 'medium', 'warn', 'Na úvodní stránce nebylo nalezeno IČO', 'Typicky patří do patičky.', 'Návštěvník firemního webu má snadno poznat, kdo ho provozuje. Zkontrolujte název nebo jméno, sídlo a IČO; samotný test celou zákonnou povinnost neposuzuje.', 'Doplnit do patičky název, sídlo a IČO (u firmy i zápis v obchodním rejstříku).'));

  if (p.googleFonts) out.push(check('privacy', 'google-fonts', 'medium', 'info', 'V HTML jsou odkazy na Google Fonts', 'Při jejich načtení může dojít k předání IP adresy poskytovateli.', 'Samotný odkaz neznamená porušení pravidel ochrany údajů. Je potřeba zjistit, co se návštěvníkovi skutečně načítá a za jakých podmínek.', 'Pro omezení externích požadavků lze hostovat písma na vlastním webu.'));
  const trackers = p.thirdParty.filter(n => !/vložené video|Mapy/.test(n));
  if (trackers.length) out.push(check('privacy', 'trackers', 'medium', p.cookieBanner ? 'info' : 'warn',
    `V kódu stránky jsou odkazy na služby: ${trackers.join(', ')}`,
    p.cookieBanner ? 'V kódu je také nástroj pro souhlas s cookies. Test neověřil, jak se skutečně chová.' : 'Nástroj pro souhlas s cookies nebyl v načteném kódu rozpoznán. Může se zobrazit až po spuštění dalších částí stránky.',
    'Nalezený kód ještě neznamená, že se služba spustila. Test nezkouší tlačítka cookie lišty ani to, co se načítá před souhlasem a po něm.', 'Ručně ověřit, které služby se skutečně načítají a za jakých podmínek.'));
  out.push(check('privacy', 'privacy', 'medium', p.privacyLink ? 'pass' : (p.forms ? 'warn' : 'info'),
    p.privacyLink ? 'Web odkazuje na zásady ochrany osobních údajů' : 'Odkaz na zásady ochrany osobních údajů nebyl nalezen',
    (p.privacyLink ? 'Odkaz je na stránce uvedený. Test tímto bodem neověřil obsah ani správnost odkazovaných zásad.' : 'V načteném HTML se odkaz nepodařilo rozpoznat. Může být načítán až skriptem.') + (p.forms ? ` Na stránce: ${plural(p.forms, 'formulář', 'formuláře', 'formulářů')}.` : ''),
    'Návštěvník má vědět, kdo jeho osobní údaje používá, proč a jak dlouho. Zvlášť důležité je to u formulářů a přihlášení k odběru zpráv.', p.privacyLink ? '—' : 'Ověřit odkaz a jeho dostupnost u formuláře a v patičce. Pokud chybí, doplnit jej.'));

  return out;
}

function decodeSafe(u) {
  try { const x = new URL(u); return decodeURI(x.pathname + x.search); } catch { return u; }
}

function dupes(list) {
  const seen = new Map();
  list.filter(Boolean).forEach(t => seen.set(t, (seen.get(t) || 0) + 1));
  return [...seen.values()].filter(n => n > 1).length;
}

// Skóre kategorie: pass = 1, warn = 0,5, fail = 0, vážené důležitostí; info se nepočítá
export function score(checks) {
  const result = {};
  for (const cat of Object.keys(CATEGORIES)) {
    const list = checks.filter(c => c.category === cat && c.status !== 'info');
    if (!list.length) continue;
    const total = list.reduce((s, c) => s + c.weight, 0);
    const got = list.reduce((s, c) => s + c.weight * ({ pass: 1, warn: 0.5, fail: 0 }[c.status]), 0);
    result[cat] = Math.round((got / total) * 100);
  }
  return result;
}

// Ochrana domény před podvrženými e-maily (SPF a DMARC podle záznamů v DNS).
// dns = { txt: [...], dmarc: [...], mx: počet MX záznamů } nebo null, když DNS nešlo přečíst.
export function emailChecks(dns, domain) {
  if (!dns) return [check('email', 'dns-unavailable', 'medium', 'info', 'E-mailová pravidla se nepodařilo ověřit', 'Nepodařilo se získat nastavení domény.', 'Z neúspěšné kontroly nelze poznat, zda je ochrana nastavená správně, chybně, nebo vůbec.', 'Zopakovat test nebo zkontrolovat DNS u správce domény.')];
  const out = [];
  const spf = dns.txt.filter(t => /^v=spf1(\s|$)/i.test(t));
  const where = 'Nejdřív sepište všechny služby, které za doménu odesílají, a ověřte SPF i DKIM podle jejich návodů.';
  if (spf.length > 1) {
    out.push(check('email', 'spf', 'high', 'fail', 'Doména má více záznamů SPF', `Nalezeno: ${spf.length}.`, 'Více záznamů v=spf1 způsobuje chybu SPF.', 'Sloučit povolené odesílatele do jednoho záznamu.'));
  } else if (!spf.length) {
    out.push(check('email', 'spf', 'high', 'warn', 'Záznam SPF nebyl nalezen', `Kontrolována doména ${domain}.`, 'SPF určuje povolené odesílací servery. To, že doména nepřijímá poštu, neznamená, že ji neodesílá.', `${where} Pravidlo v=spf1 -all použít jen tehdy, pokud doména skutečně nic neodesílá.`));
  } else {
    const all = [...spf[0].matchAll(/(?:^|\s)([~?+-]?)all(?=\s|$)/gi)];
    const restricted = all.length === 1 && ['-', '~'].includes(all[0][1]) && !/\+all\b/i.test(spf[0]);
    out.push(check('email', 'spf', 'high', restricted ? 'pass' : 'warn', restricted ? 'SPF omezuje, které servery mohou odesílat vaši poštu' : 'SPF potřebuje podrobnější kontrolu',
      spf[0].slice(0, 300),
      'SPF říká, které servery mohou posílat poštu za vaši doménu. Test ověřil základní podobu pravidla; nezkoušel skutečné odeslání ani všechny navazující podmínky.',
      restricted ? 'Ověřit také DKIM a výsledek SPF/DMARC v hlavičkách skutečně odeslaného e-mailu.' : `${where} Nepřepisovat záznam naslepo.`));
  }
  const records = dns.dmarc.filter(t => /^v=DMARC1(?:\s*;|\s*$)/i.test(t));
  const dmarc = records[0];
  const entries = dmarc?.split(';').map(t => t.trim()).filter(Boolean).map(t => (t.match(/^([^=]+)\s*=\s*(.*)$/)?.slice(1).map(x => x.trim()) || [t])) || [];
  const tags = Object.fromEntries(entries.map(([k, v]) => [k.toLowerCase(), v]));
  const policy = tags.p?.toLowerCase();
  const pct = tags.pct == null ? 100 : /^\d{1,3}$/.test(tags.pct) ? Number(tags.pct) : NaN;
  const invalid = records.length > 1 || (dmarc && (entries.some(t => t.length !== 2) || new Set(entries.map(([k]) => k.toLowerCase())).size !== entries.length || entries[1]?.[0]?.toLowerCase() !== 'p' || !['none', 'quarantine', 'reject'].includes(policy) || !Number.isFinite(pct) || pct > 100));
  if (invalid) {
    out.push(check('email', 'dmarc', 'high', 'fail', 'DMARC má chybné nebo nejednoznačné nastavení', records.join(' · ').slice(0, 600), 'Pravidlo chybí, opakuje se nebo obsahuje neplatnou hodnotu. Příjemci pošty ho pak nemusí správně použít.', 'Opravit jediný záznam podle dokumentace poskytovatele. Před zpřísněním ověřit skutečné odesílatele.'));
  } else if (!dmarc) {
    out.push(check('email', 'dmarc', 'high', 'warn', 'Záznam DMARC nebyl nalezen', `_dmarc.${domain}`, 'DMARC říká příjemci, co má udělat s poštou, která neprojde ověřením odesílatele vaší domény.', `${where} Začít monitorovací politikou p=none a hlášením na adresu, kterou spravujete; zpřísňovat až po vyhodnocení.`));
  } else if (policy === 'none' || pct === 0) {
    const reporting = !!tags.rua;
    out.push(check('email', 'dmarc', 'high', 'warn', 'DMARC nepožaduje karanténu ani odmítnutí zpráv', dmarc,
      `Nastavení ${policy === 'none' ? 'p=none' : 's pct=0'} nepožaduje, aby příjemci podezřelé zprávy odmítali.${reporting ? ' Záznam uvádí adresu pro souhrnná hlášení; jejich doručení nebylo ověřeno.' : ' Chybí rua, tedy adresa pro souhrnná hlášení o ověřování pošty.'}`,
      `${where} Až ověříte, že legitimní pošta prochází, zvažte postupný přechod na p=quarantine a p=reject. Bez kontroly můžete omezit vlastní poštu.`));
  } else {
    out.push(check('email', 'dmarc', 'high', pct < 100 ? 'warn' : 'pass', `DMARC požaduje ${policy === 'reject' ? 'odmítnutí' : 'karanténu'} neověřených zpráv`, dmarc,
      `Požadavek se týká ${pct} % zpráv podle politiky. Konečné zacházení určuje přijímající server. Nebylo ověřeno DKIM, shoda domén ani skutečné doručení.`, 'Ověřit hlavičky zpráv od všech skutečných odesílatelů a sledovat DMARC hlášení.'));
  }
  return out;
}

// Zabezpečení domény: DNSSEC, CAA a security.txt (prvky, které hlídají i kontroly „kybernetické hygieny“ podle NIS2)
export function domainChecks(dns, domain, securityTxt) {
  const out = [];
  if (dns?.ds != null) out.push(dns.ds > 0
    ? check('security', 'dnssec', 'medium', 'pass', 'V DNS byl nalezen záznam DS pro DNSSEC', `Pro doménu ${domain} byl nalezen záznam DS.`, 'DNSSEC pomáhá ověřovat správnost údajů o doméně. Test našel součást tohoto nastavení, nikoli důkaz, že celé ověření funguje.', '—')
    : check('security', 'dnssec', 'medium', 'warn', 'U domény nebyl nalezen ověřovací záznam pro DNSSEC', `Pro doménu ${domain} nebyl nalezen záznam DS.`,
      'DNSSEC pomáhá ověřovat, že údaje o doméně nejsou podvržené. Chybějící záznam je důvod pro kontrolu u správce domény, nikoli důkaz napadení webu.',
      'Zapnout DNSSEC u správce DNS (často jedno tlačítko, např. v Cloudflare DNS → Settings) a případně vložit záznam DS u registrátora domény.'));
  if (dns?.caa != null) out.push(dns.caa > 0
    ? check('security', 'caa', 'low', 'pass', 'Doména určuje, kdo smí vydat její certifikát (CAA)', 'Test našel záznam určující povolené vydavatele certifikátu.', 'CAA omezuje autority oprávněné vydat certifikát. Test ověřuje přítomnost záznamu, ne správnost celé politiky.', '—')
    : check('security', 'caa', 'low', 'info', 'Doména nemá záznam CAA', 'Volitelné doporučení.', 'CAA určuje, které autority smí vydat SSL certifikát pro doménu. Je to doplňková ochrana proti podvrženým certifikátům.', 'Přidat záznam CAA pro autoritu, která certifikát vydává (např. letsencrypt.org). Pozor, chybný záznam zablokuje obnovu certifikátu.'));
  out.push(securityTxt === null
    ? check('security', 'security-txt', 'low', 'info', 'Soubor security.txt se nepodařilo ověřit', 'Server neodpověděl nebo automatickou kontrolu odmítl.', 'Nejde o potvrzení chybějícího souboru.', 'Ověřit /.well-known/security.txt ručně.')
    : securityTxt
    ? check('security', 'security-txt', 'low', 'pass', 'Web má soubor security.txt', 'Kontakt pro nahlášení bezpečnostních chyb je na /.well-known/security.txt.', 'Kdo najde na webu zranitelnost, ví, komu ji nahlásit.', '—')
    : check('security', 'security-txt', 'low', 'info', 'Chybí soubor security.txt', 'Na /.well-known/security.txt není kontakt pro hlášení bezpečnostních chyb.', 'Jde o doplňkový kontakt pro lidi, kteří objeví bezpečnostní chybu. Chybějící soubor sám o sobě neznamená, že je web nebezpečný nebo porušuje zákon.', 'Vytvořit /.well-known/security.txt s řádky Contact: mailto:vas@email.cz a Expires: (datum za rok).'));
  return out;
}
