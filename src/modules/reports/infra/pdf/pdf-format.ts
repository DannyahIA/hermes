/**
 * Compact pt-BR date ("01/01/2026"). The title block cells are narrow, and
 * dd/mm/aaaa is how a Brazilian printed document dates itself anyway.
 */
export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

export function formatIssuedAt(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

/** "set. de 2026" — for table rows, where a bare month would be ambiguous across years. */
export function formatMonthYear(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatPeriod(from: Date, to: Date): string {
  return `${formatShortDate(from)} a ${formatShortDate(to)}`;
}

const percentFormat = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 1,
});
const columnPercentFormat = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * A percentage already on the 0–100 scale, e.g. 12.34 → "12,3%". `column`
 * keeps the decimal even when it's zero ("7,0%"), so a column of shares
 * lines up on its comma.
 */
export function formatPercent(value: number, column = false): string {
  return `${(column ? columnPercentFormat : percentFormat).format(value)}%`;
}

/** Signed with an arrow, so direction never rests on color alone: "↑ +12,3%". */
export function formatDelta(deltaPercent: number): string {
  if (deltaPercent === 0) return formatPercent(0);
  const arrow = deltaPercent > 0 ? '↑' : '↓';
  const sign = deltaPercent > 0 ? '+' : '−';
  return `${arrow} ${sign}${formatPercent(Math.abs(deltaPercent), true)}`;
}

/** Stable key for matching the same calendar month across two series. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}`;
}
