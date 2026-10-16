import type { Transaction } from '@/core/entities/transaction';

import {
  calculatePeriodComparison,
  type PeriodComparison,
} from './calculate-period-comparison';

/**
 * Compares the current calendar year, Jan 1 through `now`, against the same
 * Jan-1-to-same-day-of-year window last year — never a full year against a
 * partial one, so the comparison stays fair in any month.
 */
export function calculateYearOverYear(
  transactions: Transaction[],
  categories: Array<{ id: string; name: string }>,
  now: Date = new Date(),
): PeriodComparison {
  const currentStart = new Date(now.getFullYear(), 0, 1);
  const previousStart = new Date(now.getFullYear() - 1, 0, 1);
  const previousEnd = new Date(
    now.getFullYear() - 1,
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );

  const current = transactions.filter(
    (t) => t.occurredAt >= currentStart && t.occurredAt <= now,
  );
  const previous = transactions.filter(
    (t) => t.occurredAt >= previousStart && t.occurredAt <= previousEnd,
  );

  return calculatePeriodComparison(current, previous, categories);
}
