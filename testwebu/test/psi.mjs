// Ověří zpracování odpovědi PageSpeed Insights na uloženém výsledku Lighthouse
import fs from 'fs';
import { summarizePsi } from '../lib/psi.js';
import { speedChecks, a11yChecks, lighthouseChecks } from '../lib/checks.js';

const lighthouseResult = JSON.parse(fs.readFileSync(new URL('./fixtures/lighthouse.json', import.meta.url)));
const withField = {
  lighthouseResult,
  loadingExperience: { overall_category: 'AVERAGE', metrics: {
    LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2900, category: 'AVERAGE' },
    INTERACTION_TO_NEXT_PAINT: { percentile: 180, category: 'FAST' },
    CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 5, category: 'FAST' },
  } },
};
for (const [name, data] of [['bez dat z Chrome', { lighthouseResult }], ['s daty z Chrome', withField]]) {
  const psi = summarizePsi(data);
  console.log(`\n== ${name}:`, JSON.stringify(psi.scores), 'příležitosti:', psi.opportunities.length);
  for (const c of [...speedChecks('mobile', psi), ...a11yChecks(psi), ...lighthouseChecks(psi)]) console.log(`  ${c.status.padEnd(4)} ${c.title} — ${c.detail.slice(0, 110)}`);
}
console.log('\n== chyba Googlu:', speedChecks('desktop', { error: 'Měření Googlu je teď přetížené, zkuste to za chvíli.' })[0].detail);
