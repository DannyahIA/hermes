import type { Transaction } from '@/core/entities/transaction';
import { sumByType } from '@/shared/lib/sum-by-type';

import {
  calculateCategoryComparison,
  type CategoryComparison,
} from './calculate-category-comparison';
import {
  calculatePeriodDelta,
  type PeriodDelta,
} from './calculate-period-delta';

export interface PeriodComparison {
  income: PeriodDelta;
  expense: PeriodDelta;
  byCategory: CategoryComparison[];
}

/**
 * The shared shape of "this window versus that window": overall income and
 * expense deltas plus the per-category breakdown. Which two windows are
 * compared is the caller's choice — see `calculateYearOverYear` and
 * `calculateSameMonthLastYear`.
 */
export function calculatePeriodComparison(
  currentTransactions: Transaction[],
  previousTransactions: Transaction[],
  categories: Array<{ id: string; name: string }>,
): PeriodComparison {
  return {
    income: calculatePeriodDelta(
      sumByType(currentTransactions, 'income'),
      sumByType(previousTransactions, 'income'),
    ),
    expense: calculatePeriodDelta(
      sumByType(currentTransactions, 'expense'),
      sumByType(previousTransactions, 'expense'),
    ),
    byCategory: calculateCategoryComparison(
      currentTransactions,
      previousTransactions,
      categories,
    ),
  };
}
