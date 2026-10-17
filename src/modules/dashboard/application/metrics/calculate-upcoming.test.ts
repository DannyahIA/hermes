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

import type { CardStatement } from './calculate-card-statements';
import { calculateUpcoming } from './calculate-upcoming';

const TODAY = new Date(2026, 9, 17, 15, 30);

function balance(overrides: Partial<AccountProps> = {}) {
  return {
    account: new Account({
      id: 'checking-1',
      userId: 'u1',
      name: 'Nubank Conta',
      type: 'checking',
      balance: 0,
      currency: 'BRL',
      archived: false,
      hidden: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }),
    currentBalance: 0,
  };
}

function rule(overrides: Partial<RecurringTransactionProps> = {}) {
  return new RecurringTransaction({
    id: 'rule',
    userId: 'u1',
    accountId: 'checking-1',
    description: 'Aluguel',
    amount: 1800,
    type: 'expense',
    dayRuleKind: 'fixed_day',
    dayRuleDay: 25,
    startDate: new Date(2026, 0, 1),
    lastGeneratedThrough: new Date(2026, 8, 25),
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
    installmentPlanId: 'plan-1',
    occurredAt: new Date(2026, 10, 8),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

const card = balance({ id: 'card-1', name: 'Nubank Crédito', type: 'credit' });

function statement(cycle: Partial<NonNullable<CardStatement['cycle']>>) {
  return {
    accountId: 'card-1',
    name: 'Nubank Crédito',
    owed: 0,
    cycle: {
      lastClosing: new Date(2026, 9, 3),
      nextClosing: new Date(2026, 10, 3),
      open: 0,
      openDueOn: new Date(2026, 10, 10),
      closedUnpaid: 0,
      closedDueOn: new Date(2026, 9, 10),
      overdue: false,
      ...cycle,
    },
  } satisfies CardStatement;
}

describe('calculateUpcoming', () => {
  it('lists recurring bills, installments and card bills for the next 30 days, by date', () => {
    const result = calculateUpcoming({
      balances: [balance(), card],
      recurringRules: [
        rule(),
        rule({
          id: 'salary',
          description: 'Salário',
          amount: 5200,
          type: 'income',
          dayRuleDay: 5,
          lastGeneratedThrough: new Date(2026, 9, 5),
        }),
      ],
      futureTransactions: [
        future(),
        // Past the 30 days.
        future({ id: 'later', occurredAt: new Date(2026, 11, 8) }),
      ],
      cardStatements: [statement({ open: 1240.3 })],
      today: TODAY,
    });

    expect(
      result.items.map(({ date, description, accountName, amount, kind }) => ({
        date,
        description,
        accountName,
        amount,
        kind,
      })),
    ).toEqual([
      {
        date: new Date(2026, 9, 25),
        description: 'Aluguel',
        accountName: 'Nubank Conta',
        amount: 1800,
        kind: 'recurring',
      },
      {
        date: new Date(2026, 10, 5),
        description: 'Salário',
        accountName: 'Nubank Conta',
        amount: 5200,
        kind: 'recurring',
      },
      {
        date: new Date(2026, 10, 8),
        description: 'Geladeira (4/10)',
        accountName: 'Nubank Crédito',
        amount: 349.9,
        kind: 'installment',
      },
      {
        date: new Date(2026, 10, 10),
        description: 'Fatura Nubank Crédito',
        accountName: 'Nubank Crédito',
        amount: 1240.3,
        kind: 'card-bill',
      },
    ]);
    expect(result.items[3]).toMatchObject({ partial: true });
    expect(result.totalOut).toBeCloseTo(1800 + 349.9 + 1240.3);
    expect(result.totalIn).toBe(5200);
  });

  it('puts an overdue closed bill first', () => {
    const result = calculateUpcoming({
      balances: [card],
      recurringRules: [],
      futureTransactions: [],
      cardStatements: [statement({ closedUnpaid: 900, overdue: true })],
      today: TODAY,
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        date: new Date(2026, 9, 10),
        amount: 900,
        kind: 'card-bill',
        overdue: true,
        partial: false,
      }),
    ]);
  });

  it('leaves out hidden accounts, paused rules and transfers', () => {
    const result = calculateUpcoming({
      balances: [balance(), balance({ id: 'hidden-1', hidden: true })],
      recurringRules: [
        rule({ active: false }),
        rule({ id: 'hidden-rule', accountId: 'hidden-1' }),
      ],
      futureTransactions: [
        future({ accountId: 'checking-1', type: 'transfer' }),
      ],
      cardStatements: [],
      today: TODAY,
    });

    expect(result.items).toEqual([]);
  });
});
