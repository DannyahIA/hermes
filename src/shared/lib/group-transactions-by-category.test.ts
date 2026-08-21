import { describe, expect, it } from 'vitest';

import { groupTransactionsByCategory } from '@/shared/lib/group-transactions-by-category';

interface Item {
  categoryId?: string;
  categoryName?: string;
  amount: number;
}

describe('groupTransactionsByCategory', () => {
  it('groups items by categoryName, sorted by group total descending', () => {
    const items: Item[] = [
      { categoryId: 'c1', categoryName: 'Alimentação', amount: 100 },
      { categoryId: 'c2', categoryName: 'Transporte', amount: 500 },
      { categoryId: 'c1', categoryName: 'Alimentação', amount: 50 },
    ];

    const groups = groupTransactionsByCategory(items);

    expect(groups.map((g) => g.label)).toEqual(['Transporte', 'Alimentação']);
    expect(groups[1].items).toHaveLength(2);
  });

  it('puts uncategorized items in a "Sem categoria" group, sorted last regardless of total', () => {
    const items: Item[] = [
      { categoryId: undefined, categoryName: undefined, amount: 1000 },
      { categoryId: 'c1', categoryName: 'Alimentação', amount: 10 },
    ];

    const groups = groupTransactionsByCategory(items);

    expect(groups.map((g) => g.label)).toEqual([
      'Alimentação',
      'Sem categoria',
    ]);
  });

  it('handles an empty list', () => {
    expect(groupTransactionsByCategory([])).toEqual([]);
  });
});
