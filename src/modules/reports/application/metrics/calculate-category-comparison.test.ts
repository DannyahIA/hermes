import { describe, expect, it } from 'vitest';

import { Category } from '@/core/entities/category';
import { Transaction } from '@/core/entities/transaction';

import { calculateCategoryComparison } from './calculate-category-comparison';

function tx(id: string, categoryId: string, amount: number) {
  return new Transaction({
    id,
    accountId: 'acc-1',
    description: 'x',
    categoryId,
    amount,
    type: 'expense',
    occurredAt: new Date('2026-07-01'),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('calculateCategoryComparison', () => {
  it('computes currentTotal/previousTotal/deltaPercent per category', () => {
    const categories = [
      new Category({
        id: 'cat-1',
        userId: 'u1',
        name: 'Alimentação',
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ];
    const result = calculateCategoryComparison(
      [tx('t2', 'cat-1', 150)],
      [tx('t1', 'cat-1', 100)],
      categories,
    );
    expect(result).toEqual([
      {
        categoryId: 'cat-1',
        categoryName: 'Alimentação',
        currentTotal: 150,
        previousTotal: 100,
        deltaPercent: 50,
      },
    ]);
  });

  it('returns deltaPercent: null for a category with no previous spending', () => {
    const result = calculateCategoryComparison(
      [tx('t1', 'cat-new', 80)],
      [],
      [],
    );
    expect(result[0]).toMatchObject({ previousTotal: 0, deltaPercent: null });
  });

  it('sorts by absolute growth (currentTotal - previousTotal) descending', () => {
    const current = [tx('t2', 'cat-small', 20), tx('t4', 'cat-big', 800)];
    const previous = [tx('t1', 'cat-small', 2), tx('t3', 'cat-big', 500)];
    const result = calculateCategoryComparison(current, previous, []);
    expect(result[0].categoryId).toBe('cat-big');
  });
});
