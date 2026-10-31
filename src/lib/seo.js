// Shared defaults for our generated HTML; explicit page metadata always wins.
const ORIGIN = 'https://janyskovadigital.cz';
const jsonLdPattern = /<script type="application\/ld\+json">(.*?)<\/script>/gs;
const decode = (text) =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
const escapeAttribute = (text) =>
  text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function schemaNodes(html) {
  const nodes = [];
  function visit(value) {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return;
    nodes.push(value);
    for (const child of Object.values(value)) {
      if (child && typeof child === 'object') visit(child);
    }
  }
  for (const [, json] of html.matchAll(jsonLdPattern)) visit(JSON.parse(json));
  return nodes;
}

export function completeSeo(html, faqPairs = []) {
  const head = html.split('</head>')[0];
  if (/name="robots" content="[^"]*noindex/.test(head)) return html;
  const url = head.match(/rel="canonical" href="([^"]+)"/)?.[1];
  if (!url) throw new Error('Indexovatelná stránka nemá canonical.');
  const title = decode(head.match(/<title>([^<]+)<\/title>/)?.[1] || '');
  const description = decode(
    head.match(/name="description" content="([^"]+)"/)?.[1] || '',
  );
  const image =
    head.match(/property="og:image" content="([^"]+)"/)?.[1] ||
    `${ORIGIN}/og-image.png`;
  const additions = [];
  const meta = (kind, name, value) => {
    if (!head.includes(`${kind}="${name}"`))
      additions.push(
        `<meta ${kind}="${name}" content="${escapeAttribute(value)}">`,
      );
  };
  for (const [name, value] of Object.entries({
    'og:title': title,
    'og:description': description,
    'og:url': url,
    'og:type': 'website',
    'og:locale': 'cs_CZ',
    'og:image': image,
    'og:image:alt': title,
  }))
    meta('property', name, value);
  for (const [name, value] of Object.entries({
    'twitter:card': 'summary_large_image',
    'twitter:title': title,
    'twitter:description': description,
    'twitter:image': image,
    'twitter:image:alt': title,
  }))
    meta('name', name, value);

  const nodes = schemaNodes(head);
  const hasType = (type) =>
    nodes.some((node) => [].concat(node['@type'] || []).includes(type));
  const graph = [];
  if (
    !nodes.some(
      (node) =>
        node.url === url &&
        []
          .concat(node['@type'] || [])
          .some((type) =>
            [
              'WebPage',
              'CollectionPage',
              'FAQPage',
              'AboutPage',
              'ContactPage',
            ].includes(type),
          ),
    )
  ) {
    graph.push({
      '@type': 'WebPage',
      '@id': url,
      url,
      name: title,
      description,
      inLanguage: 'cs',
      isPartOf: { '@id': `${ORIGIN}/#website` },
      publisher: { '@id': `${ORIGIN}/#business` },
    });
  }
  if (!hasType('BreadcrumbList') && url !== `${ORIGIN}/`) {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Domů', item: `${ORIGIN}/` },
        {
          '@type': 'ListItem',
          position: 2,
          name: title.replace(/\s*[|—].*$/, ''),
          item: url,
        },
      ],
    });
  }
  if (faqPairs.length && !hasType('FAQPage')) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: faqPairs.map(([question, answer]) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer },
      })),
    });
  }
  if (graph.length) {
    const json = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': graph,
    }).replace(/</g, '\\u003c');
    additions.push(`<script type="application/ld+json">${json}</script>`);
  }
  return additions.length
    ? html.replace('</head>', `${additions.join('\n')}\n</head>`)
    : html;
}
