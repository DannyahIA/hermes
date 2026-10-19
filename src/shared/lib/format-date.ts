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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Days from `a` to `b`, both calendar days ("2026-10-13"); counted in UTC so a daylight saving change can't shift it. */
function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round(
    (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / MS_PER_DAY,
  );
}

const dayMonthYear = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/**
 * A day as a heading in the transaction list: "Hoje", "Ontem", "Amanhã",
 * "ter., 13 de out.", or "31 de dez. de 2025" in another year. Takes
 * calendar days ("2026-10-13") already read in the server's time zone, so
 * the browser renders the same heading the server did.
 */
export function formatDayHeading(day: string, today: string): string {
  const diff = daysBetween(day, today);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  if (diff === -1) return 'Amanhã';
  const [year, month, date] = day.split('-').map(Number);
  const value = new Date(year, month - 1, date);
  return year === Number(today.slice(0, 4))
    ? weekdayDayMonth.format(value)
    : dayMonthYear.format(value);
}

const monthYear = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
});

/** "Outubro de 2026", from "2026-10". */
export function formatMonthHeading(month: string): string {
  const [year, index] = month.split('-').map(Number);
  const label = monthYear.format(new Date(year, index - 1, 1));
  return label.charAt(0).toLocaleUpperCase('pt-BR') + label.slice(1);
}

const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

/** "agora", "há 2 minutos", "há 3 horas", "ontem", or the day: when something last happened. */
export function formatSince(date: Date, now: Date): string {
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'agora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return relative.format(-minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return relative.format(-hours, 'hour');
  const label = formatDayLabel(date, now);
  return label === 'Ontem' ? 'ontem' : `em ${formatDate(date)}`;
}
