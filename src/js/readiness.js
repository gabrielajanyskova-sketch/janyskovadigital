import { questions } from './readiness-data.js';
import catalogue from '../data/schema-business.json';
import { estimateReadiness, formatEstimate } from './readiness-estimate.js';

const form = document.getElementById('readiness-form');
if (form) {
  const start = document.getElementById('readiness-start');
  const steps = [...form.querySelectorAll('fieldset')];
  const result = document.getElementById('readiness-result');
  const back = document.getElementById('readiness-back');
  const next = document.getElementById('readiness-next');
  let current = 0;
  let summary = '';
  let transferred = '';
  document.getElementById('readiness-meter').max = steps.length;

  function showStep() {
    form.hidden = false;
    result.hidden = true;
    steps.forEach((step, index) => {
      step.hidden = index !== current;
      step.disabled = index !== current;
    });
    back.disabled = current === 0;
    next.textContent = current === steps.length - 1 ? 'Zobrazit cenu a checklist' : 'Pokračovat';
    document.getElementById('readiness-progress').textContent = `Otázka ${current + 1} z ${steps.length}`;
    document.getElementById('readiness-meter').value = current + 1;
    steps[current].querySelector('legend').focus();
  }

  start.hidden = false;
  start.addEventListener('click', () => {
    start.hidden = true;
    showStep();
  });
  back.addEventListener('click', () => { current--; showStep(); });
  document.getElementById('readiness-edit').addEventListener('click', () => {
    current = 0;
    showStep();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (current < steps.length - 1) { current++; showStep(); return; }
    const list = document.getElementById('readiness-checklist');
    list.replaceChildren();
    const answers = questions.map(question => {
      const selected = form.querySelector(`input[name="${question.name}"]:checked`);
      return { question, index: Number(selected.value), answer: question.options[Number(selected.value)] };
    });
    answers.forEach(({ question, answer }) => {
      const item = document.createElement('li');
      const title = document.createElement('strong');
      title.textContent = `${question.title} ${answer.label}`;
      const tip = document.createElement('p');
      tip.textContent = answer.tip;
      item.append(title, tip);
      list.append(item);
    });
    const estimate = estimateReadiness(Object.fromEntries(answers.map(({ question, index }) => [question.name, index])), catalogue);
    const price = formatEstimate(estimate);
    document.getElementById('readiness-package').textContent = `${estimate.provisional ? 'Výchozí možnost' : 'Doporučený rozsah'}: ${estimate.name}`;
    document.getElementById('readiness-price').textContent = price;
    const note = 'Orientační cena samotného webu podle aktuálního ceníku. Konečnou cenu i rozsah potvrdím předem v nabídce.' + (estimate.provisional ? ' Rozsah zatím není určený, proto ukazujeme nejnižší výchozí variantu.' : '');
    document.getElementById('readiness-price-note').textContent = note;
    document.getElementById('readiness-extras').replaceChildren(...estimate.extras.map(text => {
      const item = document.createElement('li');
      item.textContent = text;
      return item;
    }));
    summary = `Moje zadání z testu připravenosti:\n${estimate.name}: ${price}\n${note}\n${estimate.extras.join('\n')}\n\n` + answers.map(({ question, answer }) => `${question.title}\n${answer.label}\nDalší krok: ${answer.tip}`).join('\n\n');
    form.hidden = true;
    result.hidden = false;
    result.querySelector('h3').focus();
  });
  document.getElementById('readiness-contact').addEventListener('click', () => {
    const message = document.getElementById('zprava');
    if (!message) return;
    // Keep a visitor's own message; replace only the exact summary we inserted.
    if (transferred && message.value.includes(transferred)) {
      message.value = message.value.replace(transferred, summary);
    } else if (transferred !== summary) {
      message.value = [message.value.trim(), summary].filter(Boolean).join('\n\n');
    }
    transferred = summary;
    message.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('readiness-transfer-status').textContent = 'Odpovědi jsou ve zprávě. Doplňte kontakt a zprávu odešlete, až budete chtít.';
    message.focus();
  });
}
