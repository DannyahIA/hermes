import { describe, expect, it } from 'vitest';

import { Account } from '@/core/entities/account';
import { Transaction } from '@/core/entities/transaction';

import {
  calculateNetWorthByMonth,
  netWorthFetchRange,
} from './calculate-net-worth-by-month';

function account(
  overrides: Partial<{
    id: string;
    type: 'checking' | 'savings' | 'credit';
    balance: number;
    hidden: boolean;
  }> = {},
) {
  return new Account({
    id: overrides.id ?? 'acc-1',
    userId: 'u1',
    name: 'Carteira',
    type: overrides.type ?? 'checking',
    balance: overrides.balance ?? 1000,
    currency: 'BRL',
    archived: false,
    hidden: overrides.hidden ?? false,
    createdAt: new Date('2026-01-01T00:00:00'),
    updatedAt: new Date('2026-01-01T00:00:00'),
  });
}

function tx(
  overrides: Partial<{
    id: string;
    accountId: string;
    type: 'income' | 'expense' | 'transfer';
    amount: number;
    occurredAt: Date;
  }> = {},
) {
  return new Transaction({
    id: overrides.id ?? 'tx',
    accountId: overrides.accountId ?? 'acc-1',
    description: 'x',
    amount: overrides.amount ?? 100,
    type: overrides.type ?? 'expense',
    occurredAt: overrides.occurredAt ?? new Date('2026-08-10T00:00:00'),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('calculateNetWorthByMonth', () => {
  it('walks net worth backward from the current balance, ignoring transfers', () => {
    const now = new Date('2026-08-20T00:00:00');
    const transactions = [
      tx({
        id: 't1',
        type: 'income',
        amount: 300,
        occurredAt: new Date('2026-08-10T00:00:00'),
      }),
      tx({
        id: 't2',
        type: 'expense',
        amount: 100,
        occurredAt: new Date('2026-08-15T00:00:00'),
      }),
      tx({
        id: 't3',
        type: 'transfer',
        amount: 500,
        occurredAt: new Date('2026-08-20T00:00:00'),
      }),
    ];
    const points = calculateNetWorthByMonth(
      [account({ balance: 1000 })],
      transactions,
      {
        from: new Date('2026-07-01T00:00:00'),
        to: new Date('2026-08-20T00:00:00'),
      },
      now,
    );
    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ netWorth: 800 });
    expect(points[1]).toMatchObject({ netWorth: 1000 });
  });

  it('counts a credit card balance, which is debt, against net worth', () => {
    const now = new Date('2026-08-31T00:00:00');
    const points = calculateNetWorthByMonth(
      [account({ id: 'card-1', type: 'credit', balance: 300 })],
      [
        tx({
          accountId: 'card-1',
          type: 'expense',
          amount: 300,
          occurredAt: new Date('2026-08-05T00:00:00'),
        }),
      ],
      {
        from: new Date('2026-07-01T00:00:00'),
        to: new Date('2026-08-31T00:00:00'),
      },
      now,
    );
    expect(points[0]).toMatchObject({ netWorth: 0 });
    expect(points[1]).toMatchObject({ netWorth: -300 });
  });

  it('leaves net worth unchanged when a card bill is paid', () => {
    const now = new Date('2026-08-31T00:00:00');
    // Before paying: 1000 in cash, 500 owed on the card (net worth 500).
    // Paying 300 leaves 700 in cash and 200 owed — still 500.
    const points = calculateNetWorthByMonth(
      [
        account({ id: 'checking-1', balance: 700 }),
        account({ id: 'card-1', type: 'credit', balance: 200 }),
      ],
      [
        new Transaction({
          id: 'payment',
          accountId: 'checking-1',
          description: 'Pagamento de fatura',
          amount: 300,
          type: 'expense',
          settlesAccountId: 'card-1',
          occurredAt: new Date('2026-08-10T00:00:00'),
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ],
      {
        from: new Date('2026-07-01T00:00:00'),
        to: new Date('2026-08-31T00:00:00'),
      },
      now,
    );
    expect(points.map((p) => p.netWorth)).toEqual([500, 500]);
  });

  it('starts from today, not from the stored balance that already includes future installments', () => {
    const now = new Date('2026-08-20T00:00:00');
    // Stored 835 = 1000 today minus a 165 installment dated next month.
    const points = calculateNetWorthByMonth(
      [account({ balance: 835 })],
      [tx({ amount: 165, occurredAt: new Date('2026-09-10T00:00:00') })],
      {
        from: new Date('2026-08-01T00:00:00'),
        to: new Date('2026-08-31T00:00:00'),
      },
      now,
    );
    expect(points).toEqual([{ month: new Date(2026, 7, 1), netWorth: 1000 }]);
  });

  it('ends a past period on its own balance, walking back through the months after it', () => {
    const now = new Date('2026-08-20T00:00:00');
    // 1000 today; 400 was earned in August, after the June–July period.
    const points = calculateNetWorthByMonth(
      [account({ balance: 1000 })],
      [
        tx({
          type: 'income',
          amount: 400,
          occurredAt: new Date('2026-08-05T00:00:00'),
        }),
      ],
      {
        from: new Date('2026-06-01T00:00:00'),
        to: new Date('2026-07-31T00:00:00'),
      },
      now,
    );
    expect(points).toEqual([
      { month: new Date(2026, 5, 1), netWorth: 600 },
      { month: new Date(2026, 6, 1), netWorth: 600 },
    ]);
  });

  it('excludes hidden accounts', () => {
    const now = new Date('2026-08-31T00:00:00');
    const points = calculateNetWorthByMonth(
      [
        account({ id: 'visible', balance: 100 }),
        account({ id: 'hidden', balance: 5000, hidden: true }),
      ],
      [],
      {
        from: new Date('2026-08-01T00:00:00'),
        to: new Date('2026-08-31T00:00:00'),
      },
      now,
    );
    expect(points[0]?.netWorth).toBe(100);
  });
});

describe('netWorthFetchRange', () => {
  it('starts at the first day of the period.from month, with no upper bound', () => {
    const range = netWorthFetchRange({
      from: new Date('2026-07-15T00:00:00'),
    });
    expect(range).toEqual({ from: new Date(2026, 6, 1) });
  });
});
