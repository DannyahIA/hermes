import { describe, expect, it } from 'vitest';

import { Account } from '@/core/entities/account';
import { Transaction } from '@/core/entities/transaction';

import { calculateAccountSeries } from './calculate-account-series';

function account(id: string, balance: number, hidden = false) {
  return new Account({
    id,
    userId: 'u1',
    name: id,
    type: 'checking',
    balance,
    currency: 'BRL',
    archived: false,
    hidden,
    createdAt: new Date('2026-01-01T00:00:00'),
    updatedAt: new Date('2026-01-01T00:00:00'),
  });
}

function tx(
  accountId: string,
  type: Transaction['type'],
  amount: number,
  occurredAt: Date,
) {
  return new Transaction({
    id: `${accountId}-${type}-${amount}-${occurredAt.toISOString()}`,
    accountId,
    description: 'x',
    amount,
    type,
    occurredAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('calculateAccountSeries', () => {
  it('returns one series per visible account, scoped to that account only', () => {
    const now = new Date('2026-08-20T00:00:00');
    const accounts = [account('acc-1', 1000), account('acc-2', 500)];
    const transactions = [
      tx('acc-1', 'expense', 100, new Date('2026-08-10T00:00:00')),
      tx('acc-2', 'income', 50, new Date('2026-08-10T00:00:00')),
    ];
    const period = {
      from: new Date('2026-07-01T00:00:00'),
      to: new Date('2026-08-20T00:00:00'),
    };

    const series = calculateAccountSeries(accounts, transactions, period, now);

    expect(series).toHaveLength(2);
    const acc1 = series.find((s) => s.accountId === 'acc-1')!;
    expect(acc1.balanceByMonth.at(-1)).toMatchObject({ netWorth: 1000 });
    expect(acc1.balanceByMonth.at(-2)).toMatchObject({ netWorth: 1100 }); // before the 100 expense
    expect(acc1.cashFlowByMonth.at(-1)).toMatchObject({
      income: 0,
      expense: 100,
    });
  });

  it('pays down the card a bill payment settles, and counts it as the paying account’s outflow', () => {
    const now = new Date('2026-08-20T00:00:00');
    const card = new Account({
      ...account('card-1', 200).props,
      type: 'credit',
    });
    const payment = new Transaction({
      id: 'payment',
      accountId: 'checking-1',
      description: 'Pagamento de fatura',
      amount: 300,
      type: 'expense',
      settlesAccountId: 'card-1',
      occurredAt: new Date('2026-08-10T00:00:00'),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const period = {
      from: new Date('2026-07-01T00:00:00'),
      to: new Date('2026-08-20T00:00:00'),
    };

    const series = calculateAccountSeries(
      [account('checking-1', 700), card],
      [payment],
      period,
      now,
    );

    const cardSeries = series.find((s) => s.accountId === 'card-1')!;
    expect(cardSeries.balanceByMonth.map((p) => p.netWorth)).toEqual([
      500, 200,
    ]);
    const checkingSeries = series.find((s) => s.accountId === 'checking-1')!;
    expect(checkingSeries.balanceByMonth.map((p) => p.netWorth)).toEqual([
      1000, 700,
    ]);
    expect(checkingSeries.cashFlowByMonth.at(-1)).toMatchObject({
      expense: 300,
    });
  });

  it('excludes hidden accounts entirely, not just zeroing them', () => {
    const now = new Date('2026-08-20T00:00:00');
    const accounts = [account('visible', 100), account('hidden', 5000, true)];
    const period = {
      from: new Date('2026-08-01T00:00:00'),
      to: new Date('2026-08-20T00:00:00'),
    };

    const series = calculateAccountSeries(accounts, [], period, now);

    expect(series).toHaveLength(1);
    expect(series[0].accountId).toBe('visible');
  });
});
