import { describe, expect, it } from 'vitest';

import {
  Transaction,
  type TransactionProps,
} from '@/core/entities/transaction';

import { groupRecentByDay } from './group-recent-by-day';

function tx(
  id: string,
  amount: number,
  occurredAt: Date,
  overrides: Partial<TransactionProps> = {},
) {
  return new Transaction({
    id,
    accountId: 'checking-1',
    description: id,
    amount,
    type: 'expense',
    occurredAt,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

describe('groupRecentByDay', () => {
  it('groups the listed transactions by day, totaling every transaction of that day', () => {
    const coffee = tx('coffee', 12, new Date(2026, 9, 17, 9));
    const lunch = tx('lunch', 40, new Date(2026, 9, 17, 12));
    const salary = tx('salary', 5200, new Date(2026, 9, 16, 8), {
      type: 'income',
    });
    // Not listed (past the limit), but still part of the 16th's total.
    const market = tx('market', 200, new Date(2026, 9, 16, 18));
    const reserve = tx('reserve', 1000, new Date(2026, 9, 16, 19), {
      type: 'transfer',
    });
    const bill = tx('bill', 900, new Date(2026, 9, 16, 20), {
      settlesAccountId: 'card-1',
    });

    const days = groupRecentByDay(
      [lunch, coffee, salary],
      [coffee, lunch, salary, market, reserve, bill],
    );

    expect(days).toEqual([
      { date: new Date(2026, 9, 17), net: -52, transactions: [lunch, coffee] },
      { date: new Date(2026, 9, 16), net: 5000, transactions: [salary] },
    ]);
  });
});
