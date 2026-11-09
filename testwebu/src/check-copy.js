// Labels depend on the finding, so a successful check never suggests an error.
export const STATUS_LABEL = {
  pass: 'V pořádku', warn: 'Ke zlepšení', fail: 'Problém', info: 'Informace',
};

export function checkStatusLabel(check) {
  if (check.status === 'info' && /nepodařilo|nebyl[ao]? ověřen|nelze ověřit/i.test(check.title)) return 'Neověřeno';
  return STATUS_LABEL[check.status];
}

export function explanationCopy(check) {
  return {
    meaningLabel: 'Co to znamená: ',
    actionLabel: check.status === 'pass' ? 'Doporučení: '
      : check.status === 'info' ? 'Co dál: ' : 'Jak postupovat: ',
    action: check.fix && check.fix !== '—' ? check.fix : null,
  };
}
