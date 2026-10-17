import type { Transaction } from '@/core/entities/transaction';

import { resolveCategoryName, UNCATEGORIZED_KEY } from './category-key';

export interface CategorySpending {
  categoryId: string;
  categoryName: string;
  total: number;
}

export function calculateCategorySpending(
  transactions: Transaction[],
  categories: Array<{ id: string; name: string }>,
): CategorySpending[] {
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const totalsByCategory = new Map<string, number>();

  for (const transaction of transactions) {
    if (!transaction.countsAs('expense')) continue;
    const key = transaction.categoryId ?? UNCATEGORIZED_KEY;
    totalsByCategory.set(
      key,
      (totalsByCategory.get(key) ?? 0) + transaction.amount,
    );
  }

  return [...totalsByCategory.entries()]
    .map(([categoryId, total]) => ({
      categoryId,
      categoryName: resolveCategoryName(categoryId, categoriesById),
      total,
    }))
    .sort((a, b) => b.total - a.total);
}
