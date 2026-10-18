const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * An `<input type="date">` value names a calendar day, not an instant.
 * `new Date('2026-10-31')` reads it as UTC midnight — 21:00 of the day
 * before in Brazil — so a budget ending on the 31st would stop counting
 * purchases made that evening. This reads it as the start or the end of
 * that day in local time instead; anything else passes through for the
 * schema to validate.
 */
export function localDay(value: unknown, edge: 'start' | 'end'): unknown {
  if (typeof value !== 'string' || !DATE_ONLY.test(value)) return value;
  return new Date(`${value}T${edge === 'start' ? '00:00:00' : '23:59:59.999'}`);
}

/**
 * The calendar day a moment falls on, in local time, as an
 * `<input type="date">` value ("2026-10-18"). `toISOString()` would give
 * the UTC day instead — tomorrow's date after 21:00 in Brazil.
 */
export function toDateInput(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
