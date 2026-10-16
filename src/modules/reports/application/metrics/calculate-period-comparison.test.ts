import { describe, expect, it } from 'vitest';

import { Transaction } from '@/core/entities/transaction';

import { calculatePeriodComparison } from './calculate-period-comparison';

function tx(type: Transaction['type'], amount: number, categoryId?: string) {
  return new Transaction({
    id: `${type}-${amount}-${categoryId ?? 'none'}`,
    accountId: 'acc-1',
    description: 'x',
    categoryId,
    amount,
    type,
    occurredAt: new Date('2026-01-01T00:00:00'),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('calculatePeriodComparison', () => {
  it('computes income and expense deltas plus the per-category breakdown', () => {
    const current = [tx('income', 2000), tx('expense', 300, 'cat-1')];
    const previous = [tx('income', 1500), tx('expense', 200, 'cat-1')];
    const result = calculatePeriodComparison(current, previous, [
      { id: 'cat-1', name: 'Alimentação' },
    ]);
    expect(result.income).toEqual({
      currentTotal: 2000,
      previousTotal: 1500,
      deltaPercent: (500 / 1500) * 100,
    });
    expect(result.expense).toEqual({
      currentTotal: 300,
      previousTotal: 200,
      deltaPercent: 50,
    });
    expect(result.byCategory[0]).toMatchObject({
      categoryId: 'cat-1',
      currentTotal: 300,
      previousTotal: 200,
    });
  });

  it('returns deltaPercent: null for income/expense when the previous window is empty', () => {
    const result = calculatePeriodComparison([tx('income', 100)], [], []);
    expect(result.income.deltaPercent).toBeNull();
    expect(result.expense).toEqual({
      currentTotal: 0,
      previousTotal: 0,
      deltaPercent: null,
    });
  });
});
