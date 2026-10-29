// PDF report testu webu: skutečný soubor ke stažení (jsPDF), načítá se až po kliknutí na „Stáhnout PDF“.
// Text se sází písmem Plus Jakarta Sans s českými znaky; rozvržení A4 v milimetrech.

import { jsPDF } from 'jspdf';

const PAGE_W = 210;
const PAGE_H = 297;
const M = 18;                         // okraj
const W = PAGE_W - 2 * M;             // šířka sazby
const BOTTOM = PAGE_H - 22;           // spodní hranice textu (pod ní je patička)
const PINK = [192, 16, 95];
const INK = [24, 18, 32];
const DIM = [96, 86, 110];
const COLORS = { fail: [200, 40, 60], warn: [190, 120, 0], pass: [20, 140, 80], info: [80, 100, 170] };
const LABELS = { fail: 'PROBLÉM', warn: 'ZLEPŠIT', pass: 'V POŘÁDKU', info: 'INFO' };
const CONTACT = 'Gabriela Janýšková · janyskovadigital.cz · info@janyskovadigital.cz · +420 739 395 800';

// Znaky, které písmo nemá, nahradit (jinak by se v PDF vysázely jako prázdné místo)
const clean = s => String(s ?? '').replace(/→/g, '->').replace(/←/g, '<-').replace(/[^\u0000-ɏ -⁯€™−]/g, '');

async function loadFont(doc, weight) {
  const buf = await fetch(`/fonts/plus-jakarta-sans-cs-${weight}.ttf`).then(r => {
    if (!r.ok) throw new Error(`písmo ${weight} se nenačetlo (${r.status})`);
    return r.arrayBuffer();
  });
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const file = `PJS-${weight}.ttf`;
  doc.addFileToVFS(file, btoa(bin));
  doc.addFont(file, 'PJS', weight === 700 ? 'bold' : 'normal');
}

// data = { url, host, date, overall, verdict, categories: [{ name, question, score, checks: [...] }] }
export async function buildPdf(data) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  await Promise.all([loadFont(doc, 400), loadFont(doc, 700)]);
  doc.setProperties({ title: `Audit webu ${data.host}`, author: 'Gabriela Janýšková', creator: 'Test webu – testwebu.janyskovadigital.cz', subject: data.url });
  let y = M;

  const font = (size, weight = 'normal', color = INK) => { doc.setFont('PJS', weight); doc.setFontSize(size); doc.setTextColor(...color); };
  const lineH = size => size * 0.3528 * 1.4;     // pt → mm, řádkování 1,4
  const ensure = h => { if (y + h > BOTTOM) { doc.addPage(); y = M; } };
  const para = (text, size, weight, color, x = M, width = W) => {
    font(size, weight, color);
    const lines = doc.splitTextToSize(clean(text), width);
    for (const line of lines) {
      ensure(lineH(size));
      doc.text(line, x, y + lineH(size) * 0.75);
      y += lineH(size);
    }
  };

  // Hlavička
  doc.setFillColor(...PINK);
  doc.rect(0, 0, PAGE_W, 6, 'F');
  y = 16;
  font(9, 'bold', PINK);
  doc.text('TEST WEBU · AUDIT', M, y);
  font(9, 'normal', DIM);
  doc.text(clean(data.date), PAGE_W - M, y, { align: 'right' });
  y += 6;
  para(`Audit webu ${data.host}`, 22, 'bold');
  para(data.url, 10, 'normal', DIM);
  y += 4;

  // Celkové skóre
  const level = data.overall >= 90 ? 'pass' : data.overall >= 60 ? 'warn' : 'fail';
  doc.setDrawColor(...COLORS[level]);
  doc.setLineWidth(1.6);
  doc.circle(M + 13, y + 13, 12, 'S');
  font(20, 'bold', INK);
  doc.text(String(data.overall), M + 13, y + 15.5, { align: 'center' });
  font(7, 'normal', DIM);
  doc.text('ze 100', M + 13, y + 20, { align: 'center' });
  const top = y;
  y += 6;
  para(data.verdict, 15, 'bold', INK, M + 32, W - 32);
  para('Automatický test: rychlost (Google PageSpeed), technika, SEO, AI vyhledávače, bezpečnost, e-mail, GDPR a přístupnost.', 9, 'normal', DIM, M + 32, W - 32);
  y = Math.max(y, top + 28) + 4;

  // Skóre kategorií ve dvou sloupcích
  const cats = data.categories.filter(c => c.score != null);
  const colW = W / 2;
  cats.forEach((c, i) => {
    const x = M + (i % 2) * colW;
    const rowY = y + Math.floor(i / 2) * 7;
    doc.setFillColor(...COLORS[c.score >= 90 ? 'pass' : c.score >= 50 ? 'warn' : 'fail']);
    doc.circle(x + 1.5, rowY - 1.2, 1.3, 'F');
    font(10, 'normal', INK);
    doc.text(clean(c.name), x + 5, rowY);
    font(10, 'bold', INK);
    doc.text(String(c.score), x + colW - 6, rowY, { align: 'right' });
  });
  y += Math.ceil(cats.length / 2) * 7 + 4;

  // Jednotlivé kontroly po skupinách
  for (const c of data.categories) {
    if (!c.checks.length) continue;
    ensure(24);
    y += 3;
    doc.setDrawColor(230, 220, 235);
    doc.setLineWidth(0.3);
    doc.line(M, y, PAGE_W - M, y);
    y += 4;
    para(c.question, 14, 'bold');
    para(c.name.toUpperCase() + (c.score != null ? ` · ${c.score}/100` : ''), 8, 'bold', DIM);
    y += 2;
    for (const ch of c.checks) {
      ensure(14);
      const color = COLORS[ch.status];
      font(7, 'bold', color);
      const label = LABELS[ch.status];
      const lw = doc.getTextWidth(label) + 4;
      doc.setDrawColor(...color);
      doc.setLineWidth(0.3);
      doc.roundedRect(M, y + 0.4, lw, 4.6, 1, 1, 'S');
      doc.text(label, M + 2, y + 3.6);
      const textX = M + 26;
      const textW = W - 26;
      para(ch.title, 10.5, 'bold', INK, textX, textW);
      if (ch.detail) para(ch.detail, 9, 'normal', DIM, textX, textW);
      if (ch.status !== 'pass') {
        if (ch.why) para(`Proč na tom záleží: ${ch.why}`, 9, 'normal', INK, textX, textW);
        if (ch.fix && ch.fix !== '—') para(`Jak to opravit: ${ch.fix}`, 9, 'normal', INK, textX, textW);
      }
      y += 3;
    }
  }

  // Výzva k osobnímu auditu
  ensure(34);
  y += 4;
  doc.setFillColor(252, 236, 244);
  doc.roundedRect(M, y, W, 28, 3, 3, 'F');
  const boxTop = y;
  y += 5;
  para('Chcete to mít v pořádku?', 13, 'bold', PINK, M + 6, W - 12);
  para('Automatický test nevidí všechno: kvalitu textů, zpětné odkazy ani chování návštěvníků. Osobní audit s konkrétním plánem oprav připravím do 48 hodin.', 9, 'normal', INK, M + 6, W - 12);
  para('janyskovadigital.cz/#kontakt · info@janyskovadigital.cz · +420 739 395 800', 9, 'bold', INK, M + 6, W - 12);
  y = boxTop + 30;

  // Patička na každé stránce
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(230, 220, 235);
    doc.setLineWidth(0.3);
    doc.line(M, PAGE_H - 14, PAGE_W - M, PAGE_H - 14);
    font(7.5, 'normal', DIM);
    doc.text(clean(CONTACT), M, PAGE_H - 9);
    doc.text(`${i} / ${pages}`, PAGE_W - M, PAGE_H - 9, { align: 'right' });
  }
  return doc;
}

window.TestWebuPdf = { buildPdf };
