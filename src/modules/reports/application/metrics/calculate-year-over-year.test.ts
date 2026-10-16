import { describe, expect, it } from 'vitest';

import { Transaction } from '@/core/entities/transaction';

import { calculateYearOverYear } from './calculate-year-over-year';

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

describe('calculateYearOverYear', () => {
  it('compares Jan 1-to-now of this year against the same Jan 1-to-same-day window last year', () => {
    const now = new Date('2026-10-16T12:00:00');
    const transactions = [
      tx('t1', 'income', 1000, new Date('2026-05-01T00:00:00')), // inside this year's window
      tx('t2', 'income', 100, new Date('2026-11-01T00:00:00')), // after "now" -> excluded
      tx('t3', 'income', 700, new Date('2025-05-01T00:00:00')), // inside last year's window
      tx('t4', 'income', 50, new Date('2025-11-01T00:00:00')), // after last-year's cutoff day -> excluded
    ];
    const result = calculateYearOverYear(transactions, [], now);
    expect(result.income.currentTotal).toBe(1000);
    expect(result.income.previousTotal).toBe(700);
  });

  it('returns deltaPercent: null when there was no income last year', () => {
    const now = new Date('2026-10-16T12:00:00');
    const result = calculateYearOverYear(
      [tx('t1', 'income', 500, new Date('2026-05-01T00:00:00'))],
      [],
      now,
    );
    expect(result.income.deltaPercent).toBeNull();
  });
});
