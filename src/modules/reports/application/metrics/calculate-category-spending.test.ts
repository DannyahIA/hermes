import { describe, expect, it } from 'vitest';

import { Category } from '@/core/entities/category';
import { Transaction } from '@/core/entities/transaction';

import { calculateCategorySpending } from './calculate-category-spending';

function tx(
  overrides: Partial<ConstructorParameters<typeof Transaction>[0]> = {},
) {
  return new Transaction({
    id: 'tx',
    accountId: 'acc-1',
    description: 'x',
    amount: 100,
    type: 'expense',
    occurredAt: new Date('2026-08-01'),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as never);
}

function category(id: string, name: string) {
  return new Category({
    id,
    userId: 'user-1',
    name,
    archived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('calculateCategorySpending', () => {
  it('leaves card bill payments out of "Sem categoria", since the card purchases already count', () => {
    const transactions = [
      tx({ id: 'purchase', accountId: 'card-1', amount: 300 }),
      tx({ id: 'payment', amount: 300, settlesAccountId: 'card-1' }),
    ];

    expect(calculateCategorySpending(transactions, [])).toEqual([
      expect.objectContaining({ total: 300 }),
    ]);
  });

  it('ranks spending by category, grouping uncategorized expenses, descending by total', () => {
    const categories = [
      category('cat-food', 'Alimentação'),
      category('cat-transport', 'Transporte'),
    ];
    const transactions = [
      tx({ id: 't1', categoryId: 'cat-food', amount: 150 }),
      tx({ id: 't2', categoryId: 'cat-transport', amount: 40 }),
      tx({ id: 't3', amount: 200 }),
      tx({ id: 't4', type: 'income', categoryId: 'cat-food', amount: 999 }),
    ];

    expect(calculateCategorySpending(transactions, categories)).toEqual([
      {
        categoryId: 'uncategorized',
        categoryName: 'Sem categoria',
        total: 200,
      },
      { categoryId: 'cat-food', categoryName: 'Alimentação', total: 150 },
      { categoryId: 'cat-transport', categoryName: 'Transporte', total: 40 },
    ]);
  });

  it('returns an empty array when there are no expenses', () => {
    expect(calculateCategorySpending([], [])).toEqual([]);
  });
});
