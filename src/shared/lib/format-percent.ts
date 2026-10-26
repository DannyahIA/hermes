const formatters = new Map<number, Intl.NumberFormat>();

/**
 * A percentage the Brazilian way ("12,3%"), from a value already in percent
 * (12.3, not 0.123). Every percentage on screen goes through here so the
 * decimal separator never drifts back to a dot.
 */
export function formatPercent(percent: number, fractionDigits = 0): string {
  let formatter = formatters.get(fractionDigits);
  if (!formatter) {
    formatter = new Intl.NumberFormat('pt-BR', {
      style: 'percent',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    formatters.set(fractionDigits, formatter);
  }
  return formatter.format(percent / 100);
}
