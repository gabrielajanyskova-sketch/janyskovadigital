// Pravidla auditu. Každá kontrola vrací stav (pass / warn / fail / info), stručný popis zjištění,
// vysvětlení proč na tom záleží a jak to opravit — česky, pro majitele webu, ne pro programátory.

export const CATEGORIES = {
  speed: 'Rychlost',
  tech: 'Technika a indexace',
  seo: 'Obsah a SEO',
  ai: 'Strukturovaná data a AI vyhledávače',
  security: 'Bezpečnost',
  privacy: 'GDPR a důvěryhodnost',
  a11y: 'Přístupnost',
};

const WEIGHT = { high: 3, medium: 2, low: 1 };

function check(category, id, weight, status, title, detail, why, fix) {
  return { category, id, weight: WEIGHT[weight], status, title, detail, why, fix };
}

const fmtMs = ms => (ms >= 1000 ? `${(ms / 1000).toFixed(1).replace('.', ',')} s` : `${Math.round(ms)} ms`);
const plural = (n, one, few, many) => `${n} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`;

// ── Rychlost (PageSpeed) ─────────────────────────────────────────────────────

export function speedChecks(strategy, psi) {
  const label = strategy === 'mobile' ? 'mobilu' : 'počítači';
  if (!psi || psi.error || psi.scores.performance == null) {
    return [check('speed', `psi-${strategy}`, 'high', 'info', `Rychlost na ${label}`, psi?.error || 'Měření se nepodařilo.',
      'Rychlost měří Google stejným nástrojem jako PageSpeed Insights.', 'Zkuste test spustit znovu za chvíli.')];
  }
  const out = [];
  const s = psi.scores.performance;
  out.push(check('speed', `psi-${strategy}`, 'high', s >= 90 ? 'pass' : s >= 50 ? 'warn' : 'fail',
    `Skóre rychlosti na ${label}: ${s}/100`,
    s >= 90 ? 'Výborné. Web patří k rychlým.' : s >= 50 ? 'Průměr. Zákazník na pomalejším připojení čeká.' : 'Web je pomalý. Část návštěvníků odejde dřív, než se načte.',
    'Google zohledňuje rychlost v pořadí výsledků a každá vteřina navíc snižuje počet poptávek a nákupů.',
    'Zmenšit a převést obrázky do WebP, omezit skripty třetích stran, zvážit lehčí řešení než těžkou šablonu.'));

  if (strategy === 'mobile') {
    const lcp = psi.metrics.lcp?.value;
    if (lcp != null) out.push(check('speed', 'lcp', 'high', lcp <= 2500 ? 'pass' : lcp <= 4000 ? 'warn' : 'fail',
      `Hlavní obsah se zobrazí za ${fmtMs(lcp)}`, 'Měřeno na simulovaném běžném mobilu (Largest Contentful Paint). Google doporučuje do 2,5 s.',
      'Je to okamžik, kdy návštěvník poprvé vidí, co hledal. Patří mezi Core Web Vitals, které Google hodnotí.',
      'Zmenšit hlavní obrázek, načítat ho přednostně, zrychlit server a odstranit blokující skripty a styly.'));
    const cls = psi.metrics.cls?.value;
    if (cls != null) out.push(check('speed', 'cls', 'medium', cls <= 0.1 ? 'pass' : cls <= 0.25 ? 'warn' : 'fail',
      `Stabilita stránky: ${cls.toFixed(2).replace('.', ',')}`, 'Jak moc obsah při načítání poskakuje (Cumulative Layout Shift). Dobré je do 0,1.',
      'Poskakující obsah vede ke kliknutí jinam, než chtěl návštěvník, a Google ho penalizuje.',
      'Doplnit obrázkům rozměry, rezervovat místo pro reklamy a vložené prvky, načítat písma správně.'));
    const tbt = psi.metrics.tbt?.value;
    if (tbt != null) out.push(check('speed', 'tbt', 'medium', tbt <= 200 ? 'pass' : tbt <= 600 ? 'warn' : 'fail',
      `Blokování při načítání: ${fmtMs(tbt)}`, 'Jak dlouho stránka nereaguje na kliknutí, protože zpracovává JavaScript (Total Blocking Time).',
      'Zaseknutá stránka působí rozbitě. Souvisí s metrikou INP, kterou Google hodnotí.',
      'Omezit nebo odložit skripty (chaty, měření, pluginy), které stránka nepotřebuje hned.'));
    if (psi.field?.overall) {
      const st = { FAST: 'pass', AVERAGE: 'warn', SLOW: 'fail' }[psi.field.overall] || 'info';
      const parts = [];
      if (psi.field.lcp) parts.push(`LCP ${fmtMs(psi.field.lcp.p75)}`);
      if (psi.field.inp) parts.push(`INP ${fmtMs(psi.field.inp.p75)}`);
      if (psi.field.cls) parts.push(`CLS ${(psi.field.cls.p75 / 100).toFixed(2).replace('.', ',')}`);
      out.push(check('speed', 'field', 'high', st,
        st === 'pass' ? 'Skuteční návštěvníci: web je rychlý' : st === 'warn' ? 'Skuteční návštěvníci: web je průměrný' : 'Skuteční návštěvníci: web je pomalý',
        `Data z prohlížečů Chrome za posledních 28 dní${psi.field.scope === 'origin' ? ' (za celý web)' : ''}: ${parts.join(', ')}.`,
        'Tohle jsou skutečné zkušenosti vašich zákazníků. Přesně tato data Google používá pro hodnocení Core Web Vitals.',
        st === 'pass' ? 'Nic, jen to udržet.' : 'Zaměřit se na metriku, která je nejhorší (viz doporučení níže).'));
    } else {
      out.push(check('speed', 'field', 'high', 'info', 'Data od skutečných návštěvníků nejsou k dispozici',
        'Web nemá v Chrome dost návštěv, aby Google zveřejnil statistiky z reálného provozu.',
        'U menších webů je to běžné. Hodnotí se pak laboratorní měření výše.', '—'));
    }
    if (psi.opportunities?.length) {
      out.push(check('speed', 'opportunities', 'low', 'info', 'Největší příležitosti ke zrychlení',
        psi.opportunities.map(o => `${o.title} (ušetří ~${fmtMs(o.savingsMs)})`).join(' · '),
        'Seřazeno podle toho, kolik času by oprava ušetřila.', 'Začít od první položky.'));
    }
  }
  return out;
}

export function a11yChecks(psi) {
  if (!psi || psi.error || psi.scores.accessibility == null) return [];
  const s = psi.scores.accessibility;
  return [check('a11y', 'a11y-score', 'medium', s >= 90 ? 'pass' : s >= 70 ? 'warn' : 'fail',
    `Přístupnost: ${s}/100`,
    psi.failedAccessibility.length ? `Hlavní nedostatky: ${psi.failedAccessibility.slice(0, 5).join(' · ')}` : 'Bez zásadních nedostatků.',
    'Web musí být použitelný i pro lidi se zrakovým postižením, seniory nebo ovládání klávesnicí. Od června 2025 to pro e-shopy a služby vyžaduje i zákon (European Accessibility Act).',
    'Dostatečný kontrast textu, popisky obrázků a formulářů, správné pořadí nadpisů, ovládání klávesnicí.')];
}

// ── Technika, SEO, AI, bezpečnost, GDPR ─────────────────────────────────────

export function siteChecks(r) {
  const out = [];
  const p = r.page;
  const url = new URL(r.finalUrl);

  // Technika a indexace
  out.push(url.protocol === 'https:'
    ? check('tech', 'https', 'high', 'pass', 'Web běží na zabezpečeném HTTPS', 'Spojení je šifrované.', 'Bez HTTPS prohlížeč web označí jako „Nezabezpečený“ a Google ho znevýhodní.', '—')
    : check('tech', 'https', 'high', 'fail', 'Web neběží na HTTPS', 'Stránka se načítá přes nešifrované http://.', 'Prohlížeč web označí jako „Nezabezpečený“, formuláře posílají data bez šifrování a Google web znevýhodní.', 'Zapnout SSL certifikát (u většiny hostingů zdarma přes Let’s Encrypt) a přesměrovat vše na https.'));

  if (r.httpRedirect) {
    const h = r.httpRedirect;
    const st = h.toHttps ? (h.permanent ? 'pass' : 'warn') : 'fail';
    out.push(check('tech', 'http-redirect', 'high', st,
      st === 'pass' ? 'Verze http:// přesměrovává na https://' : st === 'warn' ? 'Přesměrování na https:// je jen dočasné' : 'Verze http:// nepřesměrovává na https://',
      st === 'pass' ? 'Trvalým přesměrováním 301/308.' : st === 'warn' ? 'Používá se dočasné přesměrování (302/307).' : 'Web jde otevřít i nezabezpečeně.',
      'Google pak vidí jeden web, ne dva stejné, a návštěvníci jsou vždy v bezpečí.',
      'Nastavit trvalé přesměrování 301 z http na https (u hostingu nebo v .htaccess).'));
  }

  if (r.wwwCheck) {
    out.push(check('tech', 'www', 'medium', r.wwwCheck.consistent ? 'pass' : 'warn',
      r.wwwCheck.consistent ? 'Verze s www i bez www vedou na stejnou adresu' : 'Web jde otevřít s www i bez www zvlášť',
      r.wwwCheck.consistent ? 'Jedna z variant přesměrovává na druhou.' : `${r.wwwCheck.other} se načte bez přesměrování.`,
      'Dvě adresy se stejným obsahem jsou pro Google duplicita a dělí se mezi ně hodnocení.',
      'Zvolit jednu variantu a druhou na ni trvale přesměrovat.'));
  }

  const hops = r.chain.length;
  if (hops > 1) out.push(check('tech', 'redirect-chain', 'low', 'warn', `Řetěz ${plural(hops, 'přesměrování', 'přesměrování', 'přesměrování')} před načtením`,
    r.chain.map(c => `${c.status} ${c.url}`).join(' → '), 'Každé přesměrování zdrží načtení a ubírá trochu hodnocení odkazů.', 'Odkazovat a přesměrovávat rovnou na konečnou adresu.'));

  const noindex = /noindex/i.test(p.robots || '') || /noindex/i.test(r.headers['x-robots-tag'] || '');
  out.push(noindex
    ? check('tech', 'noindex', 'high', 'fail', 'Úvodní stránka je skrytá před Googlem (noindex)', 'Stránka obsahuje pokyn „noindex“.', 'Google ji nezobrazí ve výsledcích vyhledávání.', 'Odstranit noindex (u WordPressu: Nastavení → Zobrazování → „Požádat vyhledávače…“ odškrtnout).')
    : check('tech', 'noindex', 'high', 'pass', 'Úvodní stránka smí do vyhledávání', 'Žádný zákaz indexace.', 'Google může stránku zobrazit ve výsledcích.', '—'));

  if (!r.robots.exists) out.push(check('tech', 'robots', 'low', 'warn', 'Chybí soubor robots.txt', `${url.origin}/robots.txt neexistuje.`, 'Robots.txt říká vyhledávačům a AI, co smí procházet, a odkazuje na mapu webu.', 'Vytvořit robots.txt s odkazem na sitemap.xml.'));
  else if (r.robots.blocksAll) out.push(check('tech', 'robots', 'high', 'fail', 'Robots.txt blokuje celý web', 'Obsahuje „Disallow: /“ pro všechny roboty.', 'Vyhledávače nesmí web procházet. Většinou zapomenuté nastavení z vývoje.', 'Odstranit „Disallow: /“ z robots.txt.'));
  else out.push(check('tech', 'robots', 'low', 'pass', 'Soubor robots.txt je v pořádku', 'Existuje a neblokuje celý web.', 'Vyhledávače vědí, co smí procházet.', '—'));

  out.push(r.sitemap.urls > 0
    ? check('tech', 'sitemap', 'medium', 'pass', `Mapa webu (sitemap) obsahuje ${plural(r.sitemap.urls, 'stránku', 'stránky', 'stránek')}`, r.sitemap.url, 'Pomáhá Googlu najít všechny stránky, hlavně nové.', r.robots.sitemap ? '—' : 'Doplnit odkaz na sitemap do robots.txt.')
    : check('tech', 'sitemap', 'medium', 'warn', 'Mapa webu (sitemap.xml) nebyla nalezena', 'Není na obvyklé adrese ani v robots.txt.', 'Google pak nové stránky najde pomaleji nebo vůbec.', 'Vytvořit sitemap.xml, odkázat ji v robots.txt a odeslat v Google Search Console.'));

  if (!p.canonical) out.push(check('tech', 'canonical', 'medium', 'warn', 'Chybí kanonická adresa (canonical)', 'Stránka neurčuje svou hlavní adresu.', 'Pokud jde stránka otevřít více adresami (parametry, lomítko), Google neví, kterou zobrazit.', 'Doplnit <link rel="canonical"> s hlavní adresou stránky.'));
  else {
    const same = p.canonical.replace(/\/$/, '') === r.finalUrl.replace(/\/$/, '');
    out.push(check('tech', 'canonical', 'medium', same ? 'pass' : 'warn', same ? 'Kanonická adresa je nastavená správně' : 'Kanonická adresa míří jinam',
      same ? p.canonical : `Stránka ${r.finalUrl} uvádí jako hlavní ${p.canonical}.`, 'Říká Googlu, kterou adresu stránky zobrazovat.', same ? '—' : 'Ověřit, že canonical odkazuje sám na sebe (pokud to není záměr).'));
  }

  if (r.notFound) out.push(check('tech', '404', 'medium', r.notFound.status === 404 || r.notFound.status === 410 ? 'pass' : 'warn',
    r.notFound.status === 404 || r.notFound.status === 410 ? 'Neexistující stránky vracejí chybu 404' : `Neexistující stránka vrací kód ${r.notFound.status || 'chybu'} místo 404`,
    `Testovací adresa: ${r.notFound.url}`, 'Když web na neexistující adresy odpovídá „vše v pořádku“, Google indexuje prázdné stránky (soft 404).', 'Nastavit vracení stavového kódu 404 a vlastní chybovou stránku s odkazy dál.'));

  out.push(check('tech', 'mobile', 'high', p.viewport && /width=device-width/.test(p.viewport) ? 'pass' : 'fail',
    p.viewport ? 'Web je nastavený pro mobily' : 'Web není nastavený pro mobily', p.viewport ? `viewport: ${p.viewport}` : 'Chybí značka viewport.',
    'Většina návštěv je z mobilu a Google hodnotí mobilní verzi webu.', 'Doplnit <meta name="viewport" content="width=device-width, initial-scale=1"> a responzivní design.'));

  if (!p.lang) out.push(check('tech', 'lang', 'low', 'warn', 'Není uvedený jazyk stránky', 'Chybí atribut lang u <html>.', 'Pomáhá vyhledávačům, překladačům a čtečkám obrazovky.', 'Doplnit <html lang="cs">.'));

  if (p.mixedContent.length) out.push(check('security', 'mixed', 'medium', 'fail', `${plural(p.mixedContent.length, 'soubor se načítá', 'soubory se načítají', 'souborů se načítá')} nezabezpečeně`,
    p.mixedContent.slice(0, 3).join(', '), 'Na HTTPS stránce prohlížeč takové soubory blokuje nebo varuje.', 'Změnit adresy souborů na https://.'));

  if (r.ttfb != null) out.push(check('speed', 'ttfb', 'medium', r.ttfb <= 800 ? 'pass' : r.ttfb <= 1800 ? 'warn' : 'fail',
    `Odezva serveru: ${fmtMs(r.ttfb)}`, 'Čas do stažení HTML stránky z našeho serveru.', 'Pomalý server zdrží všechno ostatní. Typicky levný sdílený hosting nebo přetížený WordPress.', 'Kvalitnější hosting, cache stránek, CDN.'));

  // Obsah a SEO
  const t = p.title || '';
  out.push(!t ? check('seo', 'title', 'high', 'fail', 'Chybí titulek stránky', 'Stránka nemá <title>.', 'Titulek je modrý odkaz ve výsledcích Googlu. Bez něj si ho Google vymyslí.', 'Doplnit výstižný titulek s hlavní službou a místem, 30–60 znaků.')
    : check('seo', 'title', 'high', t.length >= 25 && t.length <= 65 ? 'pass' : 'warn', `Titulek: „${t.slice(0, 80)}${t.length > 80 ? '…' : ''}“`,
      `${plural(t.length, 'znak', 'znaky', 'znaků')}${t.length > 65 ? ' (Google zobrazí asi 60, zbytek usekne)' : t.length < 25 ? ' (zbytečně krátký)' : ''}.`,
      'Titulek nejvíc ovlivňuje, jestli na web ve výsledcích někdo klikne.', t.length >= 25 && t.length <= 65 ? '—' : 'Upravit na 30–60 znaků: hlavní služba, místo, značka.'));

  const d = p.description || '';
  out.push(!d ? check('seo', 'description', 'medium', 'warn', 'Chybí popis stránky (meta description)', 'Google si úryvek vybere z textu sám.', 'Popis je text pod odkazem ve výsledcích. Dobrý popis zvyšuje počet kliknutí.', 'Doplnit popis 120–160 znaků s výhodou a výzvou k akci.')
    : check('seo', 'description', 'medium', d.length >= 70 && d.length <= 165 ? 'pass' : 'warn', 'Popis stránky (meta description)', `${plural(d.length, 'znak', 'znaky', 'znaků')}: „${d.slice(0, 160)}${d.length > 160 ? '…' : ''}“`,
      'Text pod odkazem ve výsledcích Googlu.', d.length >= 70 && d.length <= 165 ? '—' : 'Upravit na 120–160 znaků.'));

  const h1 = p.headings.filter(h => h.level === 1);
  out.push(check('seo', 'h1', 'medium', h1.length === 1 ? 'pass' : h1.length === 0 ? 'fail' : 'warn',
    h1.length === 1 ? 'Stránka má jeden hlavní nadpis (H1)' : h1.length === 0 ? 'Chybí hlavní nadpis (H1)' : `Stránka má ${h1.length} hlavních nadpisů (H1)`,
    h1.map(h => `„${h.text}“`).slice(0, 3).join(', ') || '—',
    'Hlavní nadpis říká Googlu, AI i návštěvníkovi, o čem stránka je.', h1.length === 1 ? '—' : 'Mít na stránce právě jeden H1 s hlavním tématem.'));

  const skips = p.headings.filter((h, i) => i > 0 && h.level > p.headings[i - 1].level + 1).length;
  if (skips) out.push(check('seo', 'heading-order', 'low', 'warn', 'Nadpisy přeskakují úrovně', `${plural(skips, 'místo', 'místa', 'míst')}, kde např. po H1 následuje rovnou H3.`, 'Logická osnova nadpisů pomáhá vyhledávačům, AI i čtečkám obrazovky.', 'Řadit nadpisy H1 → H2 → H3 bez přeskakování.'));

  const noAlt = p.images.filter(i => !i.hasAlt).length;
  if (p.images.length) out.push(check('seo', 'alt', 'medium', noAlt === 0 ? 'pass' : 'warn',
    noAlt === 0 ? 'Všechny obrázky mají popisek (alt)' : `${plural(noAlt, 'obrázek nemá', 'obrázky nemají', 'obrázků nemá')} popisek (alt)`,
    `Celkem obrázků: ${p.images.length}.`, 'Popisek čte Google (vyhledávání obrázků) i nevidomí uživatelé.', noAlt ? 'Doplnit krátký popis, co je na obrázku. Dekorativní obrázky alt="".' : '—'));

  const noSize = p.images.filter(i => !i.hasSize).length;
  if (p.images.length && noSize) out.push(check('speed', 'img-size', 'low', 'warn', `${plural(noSize, 'obrázek nemá', 'obrázky nemají', 'obrázků nemá')} zadané rozměry`, 'Chybí atributy width a height.', 'Prohlížeč neví, kolik místa obrázku nechat, a obsah při načítání poskakuje.', 'Doplnit width a height podle skutečného poměru stran.'));

  const og = p.og;
  out.push(check('seo', 'og', 'low', og.title && og.image ? 'pass' : 'warn',
    og.title && og.image ? 'Náhled pro sociální sítě je nastavený' : 'Chybí náhled pro sociální sítě (Open Graph)',
    og.title && og.image ? `Obrázek: ${og.image}` : 'Při sdílení na Facebooku, LinkedInu nebo WhatsAppu se nezobrazí pěkný náhled.',
    'Sdílený odkaz s obrázkem a titulkem dostane výrazně víc kliknutí.', og.title && og.image ? '—' : 'Doplnit og:title, og:description a og:image (1200 × 630 px).'));

  if (p.words < 200) out.push(check('seo', 'thin', 'medium', 'warn', `Na úvodní stránce je málo textu (${p.words} slov)`, 'Vyhledávače a AI potřebují text, aby pochopily, co nabízíte.', 'Stránka s pár větami těžko získá pozice na konkurenční dotazy.', 'Popsat služby, pro koho jsou, kde působíte, ceny, časté otázky.'));

  if (r.pages.length) {
    const dupTitles = dupes(r.pages.map(x => x.title).concat(p.title));
    const noDesc = r.pages.filter(x => !x.description).length;
    const badH1 = r.pages.filter(x => x.h1 !== 1).length;
    const broken = r.pages.filter(x => x.status >= 400);
    const issues = [];
    if (dupTitles) issues.push(`${plural(dupTitles, 'duplicitní titulek', 'duplicitní titulky', 'duplicitních titulků')}`);
    if (noDesc) issues.push(`${noDesc}× chybí popis`);
    if (badH1) issues.push(`${badH1}× chybí nebo je víc H1`);
    if (broken.length) issues.push(`${broken.length}× chyba ${broken.map(b => b.status).join(', ')}`);
    out.push(check('seo', 'subpages', 'medium', issues.length ? 'warn' : 'pass',
      `Kontrola ${plural(r.pages.length, 'další stránky', 'dalších stránek', 'dalších stránek')}`,
      (issues.length ? issues.join(' · ') : 'Titulky, popisy a nadpisy jsou v pořádku.') +
        ` Stránky: ${r.pages.map(x => { try { return decodeURI(new URL(x.url).pathname); } catch { return x.url; } }).join(', ')}`,
      'Každá stránka by měla mít vlastní titulek, popis a jeden H1, aby mohla samostatně soutěžit ve vyhledávání.',
      issues.length ? 'Projít uvedené stránky a doplnit unikátní titulky a popisy.' : '—'));
  }

  // Strukturovaná data a AI vyhledávače
  const valid = p.jsonLd.filter(j => j.valid);
  const types = [...new Set(valid.flatMap(j => j.types))];
  if (p.jsonLd.some(j => !j.valid)) out.push(check('ai', 'schema-invalid', 'high', 'fail', 'Strukturovaná data obsahují chybu', 'Data JSON-LD mají chybu v zápisu (syntaxi), takže je nejde přečíst.', 'Google ani AI nástroje chybná data nepřečtou.', 'Opravit JSON-LD a ověřit v nástroji Test rozšířených výsledků od Googlu.'));
  if (valid.length || !p.jsonLd.length) out.push(valid.length
    ? check('ai', 'schema', 'high', 'pass', 'Web má strukturovaná data (schema.org)', `Typy: ${types.slice(0, 10).join(', ')}`, 'Strojově čitelné údaje o firmě, službách a obsahu, ze kterých čerpá Google i AI.', '—')
    : check('ai', 'schema', 'high', 'warn', 'Chybí strukturovaná data (schema.org)', 'Na úvodní stránce nejsou žádná data JSON-LD.', 'Bez nich Google i AI odpovědi (ChatGPT, Google AI přehledy) hůř chápou, kdo jste, kde působíte a co nabízíte.', 'Doplnit LocalBusiness/Organization s adresou, telefonem a službami, u článků Article, u otázek FAQPage.'));
  const business = types.some(t => /LocalBusiness|Organization|ProfessionalService|Store|Restaurant|Corporation|Person/.test(t));
  if (valid.length && !business) out.push(check('ai', 'schema-business', 'medium', 'warn', 'Strukturovaná data neobsahují údaje o firmě', 'Chybí typ Organization nebo LocalBusiness.', 'AI a Google mapy potřebují vědět, kdo za webem stojí.', 'Doplnit Organization/LocalBusiness s názvem, adresou, kontaktem a IČO.'));

  const blocked = r.robots.aiBlocked;
  out.push(blocked.length
    ? check('ai', 'ai-bots', 'medium', 'warn', `Robots.txt blokuje AI nástroje: ${blocked.join(', ')}`, 'Tyto služby nesmí obsah webu číst.', 'Web se pak nemůže objevit v odpovědích ChatGPT, Perplexity nebo Claude. Někdy je to záměr, často zapomenuté nastavení.', 'Pokud chcete být v AI odpovědích, povolit tyto roboty v robots.txt.')
    : check('ai', 'ai-bots', 'medium', 'pass', 'AI vyhledávače mají přístup', 'Robots.txt neblokuje ChatGPT, Claude, Perplexity ani Google AI.', 'Web se může objevit v odpovědích AI asistentů.', '—'));

  out.push(r.llms
    ? check('ai', 'llms', 'low', 'pass', 'Web má soubor llms.txt', 'Shrnutí webu pro AI nástroje.', 'Nový standard, který AI pomáhá rychle pochopit, co web nabízí.', '—')
    : check('ai', 'llms', 'low', 'info', 'Web nemá soubor llms.txt', 'Volitelné doporučení.', 'llms.txt je nový, zatím nepovinný standard: stručný přehled webu pro AI nástroje.', 'Vytvořit /llms.txt s popisem firmy, služeb a odkazy na hlavní stránky.'));

  out.push(p.phone || p.email
    ? check('ai', 'contact', 'medium', 'pass', 'Kontakt je vidět přímo na stránce', [p.phone && 'telefon', p.email && 'e-mail'].filter(Boolean).join(' a ') + ' v textu stránky.', 'Viditelný kontakt zvyšuje důvěru zákazníků i hodnocení důvěryhodnosti u Googlu a AI.', '—')
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
    'Hlavičky říkají prohlížeči, jak web chránit před podvrženým kódem, odposlechem a vložením do cizí stránky.',
    missing.length ? 'Doplnit hlavičky na serveru (hosting, .htaccess nebo Cloudflare).' : '—'));

  const leak = [h['x-powered-by'], h['server']].filter(v => v && /\d/.test(v));
  if (leak.length) out.push(check('security', 'version-leak', 'low', 'warn', 'Server prozrazuje verzi softwaru', leak.join(', '), 'Útočník podle verze snadno najde známé zranitelnosti.', 'Skrýt verze v hlavičkách Server a X-Powered-By.'));

  if (r.platforms.includes('WordPress')) out.push(check('security', 'wordpress', 'low', 'info', 'Web běží na WordPressu', p.generator || 'Rozpoznáno podle souborů webu.', 'WordPress a jeho pluginy jsou nejčastějším cílem útoků. Bezpečnost stojí na pravidelných aktualizacích.', 'Aktualizovat jádro, šablonu i pluginy, odstranit nepoužívané pluginy, zálohovat.'));

  // GDPR a důvěryhodnost
  if (p.googleFonts) out.push(check('privacy', 'google-fonts', 'medium', 'warn', 'Písma se načítají z Google Fonts', 'Prohlížeč návštěvníka posílá jeho IP adresu Googlu.', 'Soudy v EU to posoudily jako porušení GDPR bez souhlasu návštěvníka.', 'Stáhnout písma a hostovat je přímo na vlastním webu.'));
  const trackers = p.thirdParty.filter(n => !/vložené video|Mapy/.test(n));
  if (trackers.length) out.push(check('privacy', 'trackers', 'medium', p.cookieBanner ? 'info' : 'warn',
    `Měřicí a marketingové nástroje: ${trackers.join(', ')}`,
    p.cookieBanner ? 'Web má lištu pro souhlas s cookies.' : 'Lišta pro souhlas s cookies nebyla nalezena (automatická kontrola nemusí poznat každou).',
    'Analytika a reklamní pixely smí v EU běžet až po souhlasu návštěvníka.', p.cookieBanner ? 'Ověřit, že se nástroje spouští až po souhlasu.' : 'Doplnit souhlas s cookies, nebo použít měření bez cookies.'));
  out.push(check('privacy', 'privacy', 'medium', p.privacyLink ? 'pass' : (p.forms ? 'warn' : 'info'),
    p.privacyLink ? 'Web odkazuje na zásady ochrany osobních údajů' : 'Odkaz na zásady ochrany osobních údajů nebyl nalezen',
    p.forms ? `Na stránce: ${plural(p.forms, 'formulář', 'formuláře', 'formulářů')}.` : '—',
    'Kdo sbírá jméno nebo e-mail (formulář, newsletter), musí podle GDPR informovat, co s údaji dělá.', p.privacyLink ? '—' : 'Doplnit stránku se zásadami a odkaz v patičce a u formuláře.'));

  return out;
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
