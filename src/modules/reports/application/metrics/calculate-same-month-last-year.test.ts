import { describe, expect, it } from 'vitest';

import { Transaction } from '@/core/entities/transaction';

import { calculateSameMonthLastYear } from './calculate-same-month-last-year';

function tx(
  id: string,
  type: Transaction['type'],
  amount: number,
  occurredAt: Date,
) {
  return new Transaction({
    id,
    accountId: 'acc-1',
    description: 'x',
    amount,
    type,
    occurredAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('calculateSameMonthLastYear', () => {
  it('compares the reference month against the same month number last year', () => {
    const reference = new Date('2026-10-16T12:00:00');
    const transactions = [
      tx('t1', 'expense', 400, new Date('2026-10-05T00:00:00')), // October 2026
      tx('t2', 'expense', 999, new Date('2026-09-05T00:00:00')), // different month -> excluded
      tx('t3', 'expense', 250, new Date('2025-10-20T00:00:00')), // October 2025
      tx('t4', 'expense', 10, new Date('2025-11-01T00:00:00')), // different month -> excluded
    ];
    const result = calculateSameMonthLastYear(transactions, [], reference);
    expect(result.expense.currentTotal).toBe(400);
    expect(result.expense.previousTotal).toBe(250);
  });
});
