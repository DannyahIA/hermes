import { describe, expect, it } from 'vitest';

import { groupTransactionsByPeriod } from '@/shared/lib/group-transactions-by-period';

interface Item {
  occurredAt: Date;
}

function at(iso: string): Item {
  return { occurredAt: new Date(iso) };
}

describe('groupTransactionsByPeriod', () => {
  // Reference "today" — a Thursday, so "últimos 7 dias" and "esta semana"
  // boundaries are unambiguous in the assertions below.
  const today = new Date('2026-08-20T12:00:00.000Z');

  it('groups today and yesterday under their own labels', () => {
    const items = [
      at('2026-08-20T09:00:00.000Z'),
      at('2026-08-19T09:00:00.000Z'),
    ];
    const groups = groupTransactionsByPeriod(items, today);

    expect(groups.map((g) => g.label)).toEqual(['Hoje', 'Ontem']);
    expect(groups[0].items).toHaveLength(1);
    expect(groups[1].items).toHaveLength(1);
  });

  it('groups the last 7 days (excluding today/yesterday) by weekday name', () => {
    const items = [at('2026-08-15T09:00:00.000Z')]; // Saturday, 5 days before today
    const groups = groupTransactionsByPeriod(items, today);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Sábado');
  });

  it('groups the rest of the current month under "Este mês"', () => {
    const items = [at('2026-08-02T09:00:00.000Z')]; // more than 7 days before today, same month
    const groups = groupTransactionsByPeriod(items, today);

    expect(groups[0].label).toBe('Este mês');
  });

  it('groups older months as "Mês de AAAA" (capitalized, Portuguese)', () => {
    const items = [at('2026-06-15T09:00:00.000Z')];
    const groups = groupTransactionsByPeriod(items, today);

    expect(groups[0].label).toBe('Junho de 2026');
  });

  it('preserves input order within and across groups (assumes caller pre-sorted newest-first)', () => {
    const items = [
      at('2026-08-20T09:00:00.000Z'),
      at('2026-08-20T08:00:00.000Z'),
      at('2026-06-01T03:00:00.000Z'),
    ];
    const groups = groupTransactionsByPeriod(items, today);

    expect(groups.map((g) => g.label)).toEqual(['Hoje', 'Junho de 2026']);
    expect(groups[0].items).toHaveLength(2);
  });

  it('handles an empty list', () => {
    expect(groupTransactionsByPeriod([], today)).toEqual([]);
  });
});
