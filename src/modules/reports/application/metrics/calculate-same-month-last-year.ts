import type { Transaction } from '@/core/entities/transaction';

import {
  calculatePeriodComparison,
  type PeriodComparison,
} from './calculate-period-comparison';

/** Compares the calendar month containing `referenceDate` against the same month number last year. */
export function calculateSameMonthLastYear(
  transactions: Transaction[],
  categories: Array<{ id: string; name: string }>,
  referenceDate: Date = new Date(),
): PeriodComparison {
  const month = referenceDate.getMonth();
  const currentStart = new Date(referenceDate.getFullYear(), month, 1);
  const currentEnd = new Date(
    referenceDate.getFullYear(),
    month + 1,
    0,
    23,
    59,
    59,
    999,
  );
  const previousStart = new Date(referenceDate.getFullYear() - 1, month, 1);
  const previousEnd = new Date(
    referenceDate.getFullYear() - 1,
    month + 1,
    0,
    23,
    59,
    59,
    999,
  );

  const current = transactions.filter(
    (t) => t.occurredAt >= currentStart && t.occurredAt <= currentEnd,
  );
  const previous = transactions.filter(
    (t) => t.occurredAt >= previousStart && t.occurredAt <= previousEnd,
  );

  return calculatePeriodComparison(current, previous, categories);
}
