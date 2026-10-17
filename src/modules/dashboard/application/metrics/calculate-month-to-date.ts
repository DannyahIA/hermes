import type { Transaction } from '@/core/entities/transaction';
import { sumByType } from '@/shared/lib/sum-by-type';

export interface MonthToDate {
  received: number;
  spent: number;
  /** Spent last month up to the same day; null if last month had no movement at all. */
  spentLastMonthSameDay: number | null;
  /** The day last month the comparison runs to (clamped to that month's length). */
  lastMonthSameDay: Date;
}

/**
 * This month so far, and last month over the same stretch of days — a fair
 * comparison on the 17th, where comparing against all of last month would
 * always make this month look cheap. `transactions` must cover both months.
 */
export function calculateMonthToDate(
  transactions: Transaction[],
  today: Date,
): MonthToDate {
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthLength = new Date(
    today.getFullYear(),
    today.getMonth(),
    0,
  ).getDate();
  const lastMonthSameDay = new Date(
    lastMonthStart.getFullYear(),
    lastMonthStart.getMonth(),
    Math.min(today.getDate(), lastMonthLength),
  );
  const lastMonthCutoff = new Date(
    lastMonthSameDay.getFullYear(),
    lastMonthSameDay.getMonth(),
    lastMonthSameDay.getDate() + 1,
  );

  const thisMonth = transactions.filter(
    (t) => t.occurredAt >= monthStart && t.occurredAt <= today,
  );
  const lastMonth = transactions.filter(
    (t) => t.occurredAt >= lastMonthStart && t.occurredAt < monthStart,
  );
  const lastMonthSoFar = lastMonth.filter(
    (t) => t.occurredAt < lastMonthCutoff,
  );

  return {
    received: sumByType(thisMonth, 'income'),
    spent: sumByType(thisMonth, 'expense'),
    spentLastMonthSameDay:
      lastMonth.length > 0 ? sumByType(lastMonthSoFar, 'expense') : null,
    lastMonthSameDay,
  };
}
