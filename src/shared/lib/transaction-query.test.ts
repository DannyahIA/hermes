import { describe, expect, it } from 'vitest';

import {
  activePeriod,
  describePeriod,
  periodRange,
  readTransactionQuery,
  toTransactionFilters,
  transactionSearch,
} from './transaction-query';

const ACCOUNT = '3f0e8a52-5f0c-4c55-9a51-0d6c2b3f9e10';
const CATEGORY = '9b1d2c3e-4f50-4a6b-8c7d-e8f9a0b1c2d3';

describe('readTransactionQuery', () => {
  it('keeps what the list understands and drops the rest', () => {
    expect(
      readTransactionQuery({
        q: '  padaria ',
        accountId: ACCOUNT,
        categoryId: 'none',
        type: 'expense',
        from: '2026-10-01',
        to: '2026-10-31',
        tab: 'recurring',
      }),
    ).toEqual({
      q: 'padaria',
      accountId: ACCOUNT,
      categoryId: 'none',
      type: 'expense',
      from: '2026-10-01',
      to: '2026-10-31',
    });
  });

  it('ignores values that would only break the query', () => {
    expect(
      readTransactionQuery(
        new URLSearchParams(
          'q=&accountId=abc&categoryId=1;drop&type=gift&from=01/10/2026&to=2026-13',
        ),
      ),
    ).toEqual({});
  });

  it('takes the first of a repeated parameter', () => {
    expect(readTransactionQuery({ type: ['income', 'expense'] })).toEqual({
      type: 'income',
    });
  });
});

describe('toTransactionFilters', () => {
  it('reads dates as whole local days and "none" as uncategorized', () => {
    expect(
      toTransactionFilters({
        q: 'padaria',
        accountId: ACCOUNT,
        categoryId: 'none',
        type: 'expense',
        from: '2026-10-01',
        to: '2026-10-31',
      }),
    ).toEqual({
      search: 'padaria',
      accountId: ACCOUNT,
      uncategorized: true,
      type: 'expense',
      from: new Date(2026, 9, 1),
      to: new Date(2026, 9, 31, 23, 59, 59, 999),
    });
    expect(toTransactionFilters({ categoryId: CATEGORY })).toEqual({
      categoryId: CATEGORY,
    });
  });
});

describe('transactionSearch', () => {
  it('writes the query back, with changes over it', () => {
    const query = { q: 'pão', type: 'expense', from: '2026-10-01' };
    expect(transactionSearch(query)).toBe(
      '?q=p%C3%A3o&type=expense&from=2026-10-01',
    );
    expect(
      transactionSearch(query, { type: undefined, to: '2026-10-31' }),
    ).toBe('?q=p%C3%A3o&from=2026-10-01&to=2026-10-31');
    expect(transactionSearch({})).toBe('');
  });
});

describe('periods', () => {
  const today = new Date(2026, 9, 19, 15, 30);

  it('spans each shortcut in whole days', () => {
    expect(periodRange('today', today)).toEqual({
      from: '2026-10-19',
      to: '2026-10-19',
    });
    expect(periodRange('last7', today)).toEqual({
      from: '2026-10-13',
      to: '2026-10-19',
    });
    expect(periodRange('thisMonth', today)).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(periodRange('lastMonth', new Date(2026, 0, 10))).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });

  it('knows which shortcut the dates came from', () => {
    expect(activePeriod({}, today)).toBeNull();
    expect(activePeriod({ from: '2026-10-01', to: '2026-10-31' }, today)).toBe(
      'thisMonth',
    );
    expect(activePeriod({ from: '2026-10-01', to: '2026-10-19' }, today)).toBe(
      'custom',
    );
    expect(activePeriod({ to: '2026-10-19' }, today)).toBe('custom');
  });

  it('says a custom period the short way', () => {
    expect(
      describePeriod({ from: '2026-10-01', to: '2026-10-15' }, today),
    ).toBe('1 a 15 de out.');
    expect(
      describePeriod({ from: '2026-10-15', to: '2026-10-15' }, today),
    ).toBe('15 de out.');
    expect(
      describePeriod({ from: '2026-09-20', to: '2026-10-15' }, today),
    ).toBe('20 de set. a 15 de out.');
    expect(
      describePeriod({ from: '2025-12-20', to: '2026-01-15' }, today),
    ).toBe('20 de dez. de 2025 a 15 de jan. de 2026');
    expect(
      describePeriod({ from: '2025-03-01', to: '2025-03-31' }, today),
    ).toBe('1 a 31 de mar. de 2025');
    expect(describePeriod({ from: '2026-10-03' }, today)).toBe(
      'Desde 3 de out.',
    );
    expect(describePeriod({ to: '2026-10-15' }, today)).toBe('Até 15 de out.');
  });
});
