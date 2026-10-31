import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { completeSeo, schemaNodes } from '../src/lib/seo.js';
import { withTimeout } from '../src/js/request-timeout.js';

const origin = 'https://janyskovadigital.cz';
async function pages(dir = '.') {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter(
        (entry) =>
          !['src', 'node_modules', '.git', 'testwebu'].includes(entry.name),
      )
      .map(async (entry) => {
        const path = `${dir}/${entry.name}`;
        return entry.isDirectory()
          ? pages(path)
          : path.endsWith('.html')
            ? [path]
            : [];
      }),
  );
  return nested.flat();
}

test('SEO: each indexable page has unique metadata, consistent canonical and a page identity', async () => {
  const titles = new Set(),
    descriptions = new Set(),
    canonicals = new Set();
  const sitemap = await readFile('sitemap.xml', 'utf8');
  for (const file of await pages()) {
    const html = await readFile(file, 'utf8');
    const head = html.split('</head>')[0];
    if (/name="robots" content="[^"]*noindex/.test(head)) continue;
    const canonical = head.match(/rel="canonical" href="([^"]+)"/)[1];
    const title = head.match(/<title>([^<]+)<\/title>/)[1];
    const description = head.match(/name="description" content="([^"]+)"/)[1];
    for (const [set, value] of [
      [titles, title],
      [descriptions, description],
      [canonicals, canonical],
    ]) {
      assert.ok(!set.has(value), `Duplicate metadata: ${file}: ${value}`);
      set.add(value);
    }
    assert.ok(canonical.startsWith(`${origin}/`), file);
    assert.ok(sitemap.includes(`<loc>${canonical}</loc>`), file);
    assert.equal(
      head.match(/property="og:url" content="([^"]+)"/)[1],
      canonical,
      file,
    );
    for (const field of [
      'og:title',
      'og:description',
      'og:image',
      'og:locale',
      'twitter:card',
      'twitter:title',
      'twitter:description',
      'twitter:image',
    ]) {
      assert.ok(head.includes(`="${field}" content="`), `${file}: ${field}`);
    }
    const nodes = schemaNodes(head);
    assert.ok(
      nodes.some(
        (node) =>
          node.url === canonical &&
          ['WebPage', 'CollectionPage', 'FAQPage'].includes(node['@type']),
      ),
      file,
    );
    for (const node of nodes.filter((node) => node['@type'] === 'FAQPage')) {
      const visible = html
        .split('</head>')[1]
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ');
      for (const question of node.mainEntity)
        assert.ok(
          visible.includes(question.name),
          `${file}: schema FAQ is not visible`,
        );
    }
  }
  assert.equal(canonicals.size, 50);
});

test('SEO: default completion preserves explicit metadata, nested breadcrumbs and idempotence', () => {
  const html = `<html><head><title>Test &amp; web</title><meta name="description" content="Popis stránky"><link rel="canonical" href="${origin}/test"><meta property="og:title" content="Vlastní název"><script type="application/ld+json">{"@type":"WebPage","url":"${origin}/test","breadcrumb":{"@type":"BreadcrumbList","itemListElement":[]}}</script></head><body></body></html>`;
  const output = completeSeo(html, [['Otázka?', 'Odpověď.']]);
  assert.ok(output.includes('property="og:title" content="Vlastní název"'));
  assert.equal(
    schemaNodes(output).filter((node) => node['@type'] === 'BreadcrumbList')
      .length,
    1,
  );
  assert.equal(
    schemaNodes(output).filter((node) => node['@type'] === 'FAQPage').length,
    1,
  );
  // An already complete document must not gain repeated tags or scripts.
  assert.equal(completeSeo(output, [['Otázka?', 'Odpověď.']]), output);
  assert.equal(
    completeSeo('<head><meta name="robots" content="noindex"></head>'),
    '<head><meta name="robots" content="noindex"></head>',
  );
});

test('request timeout: aborts pending work and preserves non-timeout errors', async () => {
  await assert.rejects(
    withTimeout(
      5,
      (signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    ),
    { name: 'TimeoutError' },
  );
  const failure = new Error('network unavailable');
  await assert.rejects(
    withTimeout(1000, async () => {
      throw failure;
    }),
    (error) => error === failure,
  );
  assert.equal(
    await withTimeout(1000, async (signal) => !signal.aborted),
    true,
  );
});
