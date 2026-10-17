import { describe, expect, it } from 'vitest';

import {
  Transaction,
  type TransactionProps,
} from '@/core/entities/transaction';

import { calculateMonthToDate } from './calculate-month-to-date';

const TODAY = new Date(2026, 9, 17, 15, 30);

function tx(overrides: Partial<TransactionProps> = {}) {
  return new Transaction({
    id: `tx-${Math.random()}`,
    accountId: 'acc-1',
    description: 'x',
    amount: 100,
    type: 'expense',
    occurredAt: new Date(2026, 9, 10),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

describe('calculateMonthToDate', () => {
  it('sums this month so far and the same stretch of last month', () => {
    const result = calculateMonthToDate(
      [
        tx({ amount: 300, occurredAt: new Date(2026, 9, 2) }),
        tx({ amount: 6200, type: 'income', occurredAt: new Date(2026, 9, 5) }),
        // Last month, up to the same day: counts.
        tx({ amount: 250, occurredAt: new Date(2026, 8, 17, 20) }),
        // Last month, after the same day: doesn't.
        tx({ amount: 999, occurredAt: new Date(2026, 8, 18) }),
      ],
      TODAY,
    );

    expect(result).toEqual({
      received: 6200,
      spent: 300,
      spentLastMonthSameDay: 250,
      lastMonthSameDay: new Date(2026, 8, 17),
    });
  });

  it('leaves a card bill payment out of what was spent', () => {
    const result = calculateMonthToDate(
      [tx({ amount: 300, settlesAccountId: 'card-1' })],
      TODAY,
    );

    expect(result.spent).toBe(0);
  });

  it('stops at the last day of a shorter previous month', () => {
    const result = calculateMonthToDate(
      [tx({ amount: 80, occurredAt: new Date(2026, 1, 28, 12) })],
      new Date(2026, 2, 31, 9),
    );

    expect(result.lastMonthSameDay).toEqual(new Date(2026, 1, 28));
    expect(result.spentLastMonthSameDay).toBe(80);
  });

  it('has nothing to compare against when last month had no movement', () => {
    const result = calculateMonthToDate([tx()], TODAY);

    expect(result.spentLastMonthSameDay).toBeNull();
  });
});
