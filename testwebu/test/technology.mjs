import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeHtml } from '../lib/html.js';
const inspect = html => analyzeHtml(html, 'https://example.cz/').technology;

test('WordPress, editor a složky šablon se rozpoznají ze skutečných prostředků', () => {
  const tech = inspect(`<link rel='stylesheet' href='/wp-content/themes/astra/style.css'>
    <link rel="stylesheet" href="https://cdn.example.cz/wp-content/themes/astra-child/style.css">
    <div class='elementor elementor-123'></div><script src='/wp-content/plugins/elementor-pro/app.js'></script>`);
  assert.deepEqual(tech, { platforms: ['WordPress'], builders: ['Elementor'], themes: ['astra', 'astra-child'] });
});

test('text, komentáře a neaktivní skripty nejsou důkazem technologie', () => {
  assert.deepEqual(inspect(`<p>WordPress Elementor /wp-content/themes/astra/style.css</p>
    <!-- <script src='/wp-content/plugins/elementor/app.js'></script> -->
    <script>const demo = '<div class="elementor-element"></div>';</script>`),
    { platforms: [], builders: [], themes: [] });
});

test('rozlišuje CMS a různé editory, umí opačné pořadí atributů', () => {
  const tech = inspect(`<meta content='WordPress 6' name='generator'>
    <div class='wpb_wrapper wp-block-group'></div><link href='/wp-content/themes/Divi/style.css'>`);
  assert.deepEqual(tech.platforms, ['WordPress']);
  assert.deepEqual(tech.builders, ['Divi', 'WPBakery', 'Bloky WordPressu (Gutenberg)']);
  assert.deepEqual(tech.themes, ['Divi']);
  assert.deepEqual(inspect('<html data-wf-site="123"><body></body></html>').platforms, ['Webflow']);
});

test('neznámý systém není označen za statický web; šablona se nebere z parametrů', () => {
  assert.deepEqual(inspect('<html><body><p>Ahoj</p></body></html>'), { platforms: [], builders: [], themes: [] });
  assert.deepEqual(inspect('<script src="/app.js?demo=/wp-content/themes/fake/style.css"></script>').themes, []);
});
