export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date);
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date);
}

/**
 * A transaction's date, with the time only when one was recorded — entries
 * made with just a date are stored at local midnight, and "00:00" on them
 * is noise.
 */
export function formatOccurredAt(date: Date): string {
  return date.getHours() === 0 && date.getMinutes() === 0
    ? formatDate(date)
    : formatDateTime(date);
}
