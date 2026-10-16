import { describe, expect, it } from 'vitest';

import { Transaction } from '@/core/entities/transaction';

import { calculateTrendStats } from './calculate-trend-stats';

function tx(categoryId: string, amount: number, occurredAt: Date) {
  return new Transaction({
    id: `${categoryId}-${amount}-${occurredAt.toISOString()}`,
    accountId: 'acc-1',
    description: 'x',
    categoryId,
    amount,
    type: 'expense',
    occurredAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('calculateTrendStats', () => {
  it('computes average/median and a rising trend over a clearly increasing series', () => {
    const transactions = [
      tx('cat-1', 100, new Date('2026-06-05T00:00:00')),
      tx('cat-1', 200, new Date('2026-07-05T00:00:00')),
      tx('cat-1', 300, new Date('2026-08-05T00:00:00')),
    ];
    const period = {
      from: new Date('2026-06-01T00:00:00'),
      to: new Date('2026-08-31T00:00:00'),
    };

    const [stats] = calculateTrendStats(
      transactions,
      [{ id: 'cat-1', name: 'Alimentação' }],
      period,
    );

    expect(stats.average).toBe(200);
    expect(stats.median).toBe(200);
    expect(stats.trend).toBe('subindo');
  });

  it('returns "insuficiente" when fewer than 2 months have data', () => {
    const transactions = [tx('cat-1', 100, new Date('2026-08-05T00:00:00'))];
    const period = {
      from: new Date('2026-08-01T00:00:00'),
      to: new Date('2026-08-31T00:00:00'),
    };

    const [stats] = calculateTrendStats(
      transactions,
      [{ id: 'cat-1', name: 'Alimentação' }],
      period,
    );

    expect(stats.trend).toBe('insuficiente');
  });

  it('returns "estável" when spending barely changes month to month', () => {
    const transactions = [
      tx('cat-1', 100, new Date('2026-06-05T00:00:00')),
      tx('cat-1', 101, new Date('2026-07-05T00:00:00')),
      tx('cat-1', 99, new Date('2026-08-05T00:00:00')),
    ];
    const period = {
      from: new Date('2026-06-01T00:00:00'),
      to: new Date('2026-08-31T00:00:00'),
    };

    const [stats] = calculateTrendStats(
      transactions,
      [{ id: 'cat-1', name: 'Alimentação' }],
      period,
    );

    expect(stats.trend).toBe('estável');
  });
});
