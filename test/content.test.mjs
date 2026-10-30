import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const read = f => fs.readFileSync(f, 'utf8');
function pages(dir = 'src/pages') { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? pages(path.join(dir, e.name)) : e.name.endsWith('.html') ? [path.join(dir, e.name)] : []); }

test('removed CMS, OAuth and light theme cannot return through build inputs', () => {
  for (const f of ['admin/index.html', 'admin/config.yml', 'functions/api/auth.js', 'functions/api/callback.js', 'src/js/theme.js', 'src/css/05-light.css']) assert(!fs.existsSync(f), f);
  assert(!read('package.json').includes('"yaml"'));
  assert(!read('main.js').includes('jd-theme'));
  assert(!read('style.css').includes('data-theme'));
  assert(!read('_headers').includes('/admin'));
});

test('no fixed maintenance offer remains in generated public copy', () => {
  for (const file of [...pages().map(f => f.replace('src/pages/', '')), 'llms.txt']) assert(!read(file).includes('Web Care'), file);
  const offers = JSON.parse(read('src/data/schema-business.json')).business.hasOfferCatalog.itemListElement;
  assert(!offers.some(o => /care|správa/i.test(o.itemOffered.name)));
  assert(!read('src/data/home.json').includes('490'));
});

test('schema domains, shared business identity and generated FAQ are consistent', () => {
  for (const file of pages().map(f => f.replace('src/pages/', ''))) {
    for (const [, raw] of read(file).matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
      const data = JSON.parse(raw), nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        if (node['@type'] === 'BlogPosting') assert(!node.breadcrumb, file);
        if ([node['@type']].flat().includes('ProfessionalService')) assert(!node.serviceType, file);
        if (node['@type'] === 'FAQPage') assert(node.mainEntity.every(q => q.name && q.acceptedAnswer.text), file);
      }
    }
  }
});

test('service URLs exist, canonicalize and occur in sitemap without old root redirect', () => {
  for (const slug of ['tvorba-webu', 'eshop']) {
    assert(read(`${slug}.html`).includes(`rel="canonical" href="https://janyskovadigital.cz/${slug}"`));
    assert(read('sitemap.xml').includes(`<loc>https://janyskovadigital.cz/${slug}</loc>`));
    assert(!read('_redirects').includes(`/${slug} / 301`));
  }
});

test('CI runs tests on supported pinned Node; prices originate from shared data', () => {
  assert(read('.github/workflows/build.yml').includes('run: npm test'));
  assert.equal(read('.nvmrc').trim(), '24');
  assert(read('build.js').includes('businessJsonLd: JSON.stringify(business)'));
  assert(read('build.js').includes("replace('{{llmsOffers}}'"));
});
