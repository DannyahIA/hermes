import { describe, expect, it } from 'vitest';

import { Account, type AccountProps } from '@/core/entities/account';
import {
  Transaction,
  type TransactionProps,
} from '@/core/entities/transaction';

import { calculateCardStatements } from './calculate-card-statements';

const TODAY = new Date(2026, 9, 17, 15, 30);

function card(currentBalance: number, overrides: Partial<AccountProps> = {}) {
  return {
    account: new Account({
      id: 'card-1',
      userId: 'u1',
      name: 'Nubank Crédito',
      type: 'credit',
      balance: currentBalance,
      currency: 'BRL',
      archived: false,
      hidden: false,
      closingDay: 3,
      dueDay: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }),
    currentBalance,
  };
}

function charge(
  amount: number,
  occurredAt: Date,
  type: 'income' | 'expense' = 'expense',
) {
  return new Transaction({
    id: `tx-${amount}-${occurredAt.getTime()}`,
    accountId: 'card-1',
    description: 'Compra',
    amount,
    type,
    occurredAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  } satisfies TransactionProps);
}

describe('calculateCardStatements', () => {
  it('splits the debt into the open statement and what is left of the closed one', () => {
    const [statement] = calculateCardStatements(
      [card(1500)],
      [
        // Previous cycle (closed on 3 Oct).
        charge(900, new Date(2026, 8, 20, 12)),
        // A purchase on closing day already belongs to the next statement.
        charge(200, new Date(2026, 9, 3, 10)),
        charge(450, new Date(2026, 9, 12, 19)),
        // A refund in the open cycle.
        charge(50, new Date(2026, 9, 14, 9), 'income'),
      ],
      TODAY,
    );

    expect(statement).toMatchObject({
      accountId: 'card-1',
      name: 'Nubank Crédito',
      owed: 1500,
      cycle: {
        lastClosing: new Date(2026, 9, 3),
        nextClosing: new Date(2026, 10, 3),
        open: 600,
        openDueOn: new Date(2026, 10, 10),
        closedUnpaid: 900,
        closedDueOn: new Date(2026, 9, 10),
        overdue: true,
      },
    });
  });

  it('has nothing left on the closed statement once it was paid', () => {
    const [statement] = calculateCardStatements(
      [card(450)],
      [charge(450, new Date(2026, 9, 12, 19))],
      TODAY,
    );

    expect(statement.cycle).toMatchObject({
      open: 450,
      closedUnpaid: 0,
      overdue: false,
    });
  });

  it('dates the bill in the following month when it is due before the closing day', () => {
    const [statement] = calculateCardStatements(
      [card(300, { closingDay: 25, dueDay: 5 })],
      [charge(300, new Date(2026, 9, 1, 12))],
      TODAY,
    );

    expect(statement.cycle).toMatchObject({
      lastClosing: new Date(2026, 8, 25),
      nextClosing: new Date(2026, 9, 25),
      openDueOn: new Date(2026, 10, 5),
      closedDueOn: new Date(2026, 9, 5),
    });
  });

  it('skips future-dated installments, which belong to later statements', () => {
    const [statement] = calculateCardStatements(
      [card(300)],
      [charge(300, new Date(2026, 9, 8)), charge(300, new Date(2026, 10, 8))],
      TODAY,
    );

    expect(statement.cycle?.open).toBe(300);
  });

  it('has no cycle without a closing and due day', () => {
    const [statement] = calculateCardStatements(
      [card(300, { closingDay: undefined, dueDay: undefined })],
      [],
      TODAY,
    );

    expect(statement).toMatchObject({ owed: 300, cycle: null });
  });

  it('lists only visible credit cards', () => {
    const statements = calculateCardStatements(
      [
        card(100),
        card(100, { id: 'hidden-card', hidden: true }),
        card(100, { id: 'archived-card', archived: true }),
        { ...card(100, { id: 'checking-1', type: 'checking' }) },
      ],
      [],
      TODAY,
    );

    expect(statements.map((s) => s.accountId)).toEqual(['card-1']);
  });
});
