import type { Transaction } from '@/core/entities/transaction';

import { calculatePeriodDelta } from './calculate-period-delta';
import { resolveCategoryName, UNCATEGORIZED_KEY } from './category-key';

export interface CategoryComparison {
  categoryId: string;
  categoryName: string;
  currentTotal: number;
  previousTotal: number;
  deltaPercent: number | null;
}

function sumExpenseByCategory(
  transactions: Transaction[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue;
    const key = transaction.categoryId ?? UNCATEGORIZED_KEY;
    totals.set(key, (totals.get(key) ?? 0) + transaction.amount);
  }
  return totals;
}

export function calculateCategoryComparison(
  currentTransactions: Transaction[],
  previousTransactions: Transaction[],
  categories: Array<{ id: string; name: string }>,
): CategoryComparison[] {
  const currentByCategory = sumExpenseByCategory(currentTransactions);
  const previousByCategory = sumExpenseByCategory(previousTransactions);
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const allCategoryIds = new Set([
    ...currentByCategory.keys(),
    ...previousByCategory.keys(),
  ]);

  return [...allCategoryIds]
    .map((categoryId) => {
      const currentTotal = currentByCategory.get(categoryId) ?? 0;
      const previousTotal = previousByCategory.get(categoryId) ?? 0;
      const delta = calculatePeriodDelta(currentTotal, previousTotal);
      return {
        categoryId,
        categoryName: resolveCategoryName(categoryId, categoriesById),
        ...delta,
      };
    })
    .sort(
      (a, b) =>
        b.currentTotal - b.previousTotal - (a.currentTotal - a.previousTotal),
    );
}
