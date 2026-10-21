import type { Transaction } from '@/core/entities/transaction';
import { ValidationError } from '@/core/errors/validation-error';
import { toDateInput } from '@/shared/lib/local-day';

const MONTH_FORMAT = /^(\d{4})-(\d{2})$/;

/** A calendar month in local time: `start` inclusive, `end` exclusive. */
export interface MonthWindow {
  /** "2026-10" */
  key: string;
  start: Date;
  end: Date;
}

/**
 * The six months that end with `month` ("YYYY-MM"), oldest first. Throws a
 * ValidationError when `month` is not a real year and month.
 */
export function monthWindows(month: string): MonthWindow[] {
  const match = MONTH_FORMAT.exec(month);
  const monthIndex = match ? Number(match[2]) - 1 : -1;
  if (!match || monthIndex < 0 || monthIndex > 11) {
    throw new ValidationError('Month must be YYYY-MM.');
  }
  const year = Number(match[1]);
  return Array.from({ length: 6 }, (_, index) => {
    const start = new Date(year, monthIndex - 5 + index, 1);
    const end = new Date(year, monthIndex - 4 + index, 1);
    return { key: toDateInput(start).slice(0, 7), start, end };
  });
}

export function inWindow(window: MonthWindow, date: Date): boolean {
  return date >= window.start && date < window.end;
}

/** The same time of day, `days` calendar days earlier. */
export function daysBefore(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

/** Rounds a money total to cents, so sums never print 2060.3999. */
export function cents(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Sum of the amounts, rounded to cents. */
export function totalOf(transactions: Transaction[]): number {
  return cents(
    transactions.reduce((total, transaction) => total + transaction.amount, 0),
  );
}

/** The change from `previous` to `current` in whole percent; null when `previous` is 0. */
export function percentChange(
  current: number,
  previous: number,
): number | null {
  return previous > 0
    ? Math.round(((current - previous) / previous) * 100)
    : null;
}

/** Oldest first, then by id: the same order for every reader. */
export function chronological(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort(
    (a, b) =>
      a.occurredAt.getTime() - b.occurredAt.getTime() ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}
