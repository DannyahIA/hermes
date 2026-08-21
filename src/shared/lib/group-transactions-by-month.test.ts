import { describe, expect, it } from 'vitest';

import { groupTransactionsByMonth } from '@/shared/lib/group-transactions-by-month';

interface Item {
  occurredAt: Date;
}

describe('groupTransactionsByMonth', () => {
  it('groups items by month/year, newest first, assuming pre-sorted input', () => {
    const items: Item[] = [
      { occurredAt: new Date('2026-08-15T12:00:00.000Z') },
      { occurredAt: new Date('2026-08-01T12:00:00.000Z') },
      { occurredAt: new Date('2026-06-20T12:00:00.000Z') },
    ];

    const groups = groupTransactionsByMonth(items);

    expect(groups.map((g) => g.label)).toEqual([
      'Agosto de 2026',
      'Junho de 2026',
    ]);
    expect(groups[0].items).toHaveLength(2);
  });

  it('handles an empty list', () => {
    expect(groupTransactionsByMonth([])).toEqual([]);
  });
});
