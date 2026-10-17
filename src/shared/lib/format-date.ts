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

const weekdayDayMonth = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** "Hoje", "Ontem", or "seg., 13 de out." — a day as a list heading. */
export function formatDayLabel(date: Date, today: Date): string {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.round(
    (new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    ).getTime() -
      day.getTime()) /
      (24 * 60 * 60 * 1000),
  );
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  return weekdayDayMonth.format(date);
}

/** "12:41", or null for an entry stored at midnight (see formatOccurredAt). */
export function formatTimeOfDay(date: Date): string | null {
  if (date.getHours() === 0 && date.getMinutes() === 0) return null;
  return new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(date);
}
