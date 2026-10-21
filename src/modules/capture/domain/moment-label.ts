const dayMonth = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
});
const time = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** Calendar days from `date` to `today`, in local time. */
function daysAgo(date: Date, today: Date): number {
  const start = (value: Date) =>
    Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  return Math.round((start(today) - start(date)) / DAY_MS);
}

/** "hoje", "ontem", or "em 19/11": the day something falls on. */
export function dayLabel(date: Date, now: Date): string {
  const days = daysAgo(date, now);
  if (days === 0) return 'hoje';
  if (days === 1) return 'ontem';
  return `em ${dayMonth.format(date)}`;
}

/**
 * "hoje 12:41", "ontem 23:05", or "17/10 09:12": when a payment happened.
 * An entry dated with a day only ("ontem") is kept at midnight, and says
 * just the day.
 */
export function momentLabel(date: Date, now: Date): string {
  const days = daysAgo(date, now);
  const day =
    days === 0 ? 'hoje' : days === 1 ? 'ontem' : dayMonth.format(date);
  if (date.getHours() === 0 && date.getMinutes() === 0) return day;
  return `${day} ${time.format(date)}`;
}
