import { describe, expect, it } from 'vitest';

import { Account, type AccountProps } from '@/core/entities/account';
import {
  Transaction,
  type TransactionProps,
} from '@/core/entities/transaction';

import { balanceEffects, netWorthContribution } from './net-worth';

function account(overrides: Partial<AccountProps> = {}) {
  return new Account({
    id: 'checking-1',
    userId: 'u1',
    name: 'Conta',
    type: 'checking',
    balance: 0,
    currency: 'BRL',
    archived: false,
    hidden: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

function tx(overrides: Partial<TransactionProps> = {}) {
  return new Transaction({
    id: 'tx',
    accountId: 'checking-1',
    description: 'x',
    amount: 100,
    type: 'expense',
    occurredAt: new Date('2026-08-10T00:00:00'),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

describe('netWorthContribution', () => {
  it('counts cash accounts for net worth', () => {
    expect(netWorthContribution(account({ type: 'checking' }), 500)).toBe(500);
    expect(netWorthContribution(account({ type: 'savings' }), 500)).toBe(500);
  });

  it('counts a credit card balance, which is debt, against net worth', () => {
    expect(netWorthContribution(account({ type: 'credit' }), 300)).toBe(-300);
  });
});

describe('balanceEffects', () => {
  const checking = account({ id: 'checking-1', type: 'checking' });
  const card = account({ id: 'card-1', type: 'credit' });
  const accountsById = new Map([
    [checking.id, checking],
    [card.id, card],
  ]);

  it('moves its own account by Account#deltaFor', () => {
    expect(balanceEffects(tx({ type: 'income' }), accountsById)).toEqual([
      { accountId: 'checking-1', delta: 100 },
    ]);
    expect(
      balanceEffects(
        tx({ accountId: 'card-1', type: 'expense' }),
        accountsById,
      ),
    ).toEqual([{ accountId: 'card-1', delta: 100 }]);
  });

  it('pays down the card a bill payment settles, as well as the paying account', () => {
    const payment = tx({ amount: 300, settlesAccountId: 'card-1' });

    expect(balanceEffects(payment, accountsById)).toEqual([
      { accountId: 'checking-1', delta: -300 },
      { accountId: 'card-1', delta: -300 },
    ]);
  });

  it('leaves a bill payment net-worth neutral', () => {
    const payment = tx({ amount: 300, settlesAccountId: 'card-1' });

    const netWorthChange = balanceEffects(payment, accountsById).reduce(
      (sum, { accountId, delta }) =>
        sum + netWorthContribution(accountsById.get(accountId)!, delta),
      0,
    );

    expect(netWorthChange).toBe(0);
  });

  it('attributes nothing to a transfer, whose row does not say which leg it is', () => {
    expect(balanceEffects(tx({ type: 'transfer' }), accountsById)).toEqual([]);
  });

  it('skips accounts it does not know about', () => {
    expect(
      balanceEffects(tx({ accountId: 'someone-else' }), accountsById),
    ).toEqual([]);
  });
});
