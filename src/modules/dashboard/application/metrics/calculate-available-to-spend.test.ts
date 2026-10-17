import { describe, expect, it } from 'vitest';

import { Account, type AccountProps } from '@/core/entities/account';
import {
  RecurringTransaction,
  type RecurringTransactionProps,
} from '@/core/entities/recurring-transaction';
import {
  Transaction,
  type TransactionProps,
} from '@/core/entities/transaction';

import { calculateAvailableToSpend } from './calculate-available-to-spend';

// Friday, 17 Oct 2026, mid-afternoon.
const TODAY = new Date(2026, 9, 17, 15, 30);

function balance(
  currentBalance: number,
  overrides: Partial<AccountProps> = {},
) {
  return {
    account: new Account({
      id: 'checking-1',
      userId: 'u1',
      name: 'Conta',
      type: 'checking',
      balance: currentBalance,
      currency: 'BRL',
      archived: false,
      hidden: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }),
    currentBalance,
  };
}

function rule(overrides: Partial<RecurringTransactionProps> = {}) {
  return new RecurringTransaction({
    id: 'rule',
    userId: 'u1',
    accountId: 'checking-1',
    description: 'Salário',
    amount: 6200,
    type: 'income',
    dayRuleKind: 'fixed_day',
    dayRuleDay: 5,
    startDate: new Date(2026, 0, 1),
    lastGeneratedThrough: new Date(2026, 9, 5),
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

function future(overrides: Partial<TransactionProps> = {}) {
  return new Transaction({
    id: 'future',
    accountId: 'card-1',
    description: 'Geladeira (4/10)',
    amount: 349.9,
    type: 'expense',
    occurredAt: new Date(2026, 9, 25),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

describe('calculateAvailableToSpend', () => {
  it('runs until the next recurring income into the checking account', () => {
    const result = calculateAvailableToSpend({
      balances: [balance(4000)],
      recurringRules: [rule()],
      futureTransactions: [],
      today: TODAY,
    });

    expect(result).toMatchObject({
      horizon: new Date(2026, 10, 5),
      horizonKind: 'income',
      incomeDescription: 'Salário',
      // 17 Oct through 4 Nov: the days the money has to last.
      daysLeft: 19,
    });
  });

  it('runs to the end of the month when no income is due within 45 days', () => {
    const result = calculateAvailableToSpend({
      balances: [balance(4000)],
      recurringRules: [],
      futureTransactions: [],
      today: TODAY,
    });

    expect(result).toMatchObject({
      horizon: new Date(2026, 9, 31),
      horizonKind: 'month-end',
      daysLeft: 15,
    });
  });

  it('takes what is owed on cards and what is scheduled before the horizon out of the checking balance', () => {
    const card = balance(1240, { id: 'card-1', type: 'credit' });
    const result = calculateAvailableToSpend({
      balances: [balance(4000), card],
      recurringRules: [
        rule(),
        rule({
          id: 'rent',
          description: 'Aluguel',
          amount: 1800,
          type: 'expense',
          dayRuleDay: 25,
          lastGeneratedThrough: new Date(2026, 8, 25),
        }),
        // Due after the salary: the salary pays for it, not today's money.
        rule({
          id: 'gym',
          description: 'Academia',
          amount: 130,
          type: 'expense',
          dayRuleDay: 8,
          lastGeneratedThrough: new Date(2026, 9, 8),
        }),
      ],
      futureTransactions: [
        future(),
        future({ id: 'later', occurredAt: new Date(2026, 10, 25) }),
      ],
      today: TODAY,
    });

    expect(result).toMatchObject({
      inChecking: 4000,
      owedOnCards: 1240,
      scheduled: 1800 + 349.9,
    });
    expect(result?.free).toBeCloseTo(4000 - 1240 - 2149.9);
    expect(result?.perDay).toBeCloseTo((4000 - 1240 - 2149.9) / 19);
  });

  it('reports no daily figure once the money is already committed', () => {
    const result = calculateAvailableToSpend({
      balances: [balance(500), balance(900, { id: 'card-1', type: 'credit' })],
      recurringRules: [],
      futureTransactions: [],
      today: TODAY,
    });

    expect(result?.free).toBe(-400);
    expect(result?.perDay).toBeNull();
  });

  it('ignores savings, hidden and archived accounts, and a card in credit', () => {
    const result = calculateAvailableToSpend({
      balances: [
        balance(4000),
        balance(15000, { id: 'savings-1', type: 'savings' }),
        balance(999, { id: 'hidden-1', hidden: true }),
        balance(999, { id: 'archived-1', archived: true }),
        balance(-50, { id: 'card-1', type: 'credit' }),
      ],
      recurringRules: [],
      futureTransactions: [],
      today: TODAY,
    });

    expect(result).toMatchObject({ inChecking: 4000, owedOnCards: 0 });
  });

  it('returns null without a checking account to spend from', () => {
    expect(
      calculateAvailableToSpend({
        balances: [balance(300, { id: 'card-1', type: 'credit' })],
        recurringRules: [],
        futureTransactions: [],
        today: TODAY,
      }),
    ).toBeNull();
  });
});
