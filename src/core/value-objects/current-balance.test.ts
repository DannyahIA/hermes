import { describe, expect, it } from 'vitest';

import { Account } from '@/core/entities/account';
import { computeCurrentBalance } from '@/core/value-objects/current-balance';

function makeAccount(type: 'checking' | 'savings' | 'credit' = 'checking') {
  return new Account({
    id: 'acc-1',
    userId: 'user-1',
    name: 'Conta',
    type,
    balance: 0,
    currency: 'BRL',
    archived: false,
    hidden: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('computeCurrentBalance', () => {
  it('returns the stored balance unchanged when there are no future transactions', () => {
    const result = computeCurrentBalance(1000, [], makeAccount());
    expect(result).toBe(1000);
  });

  it('subtracts a future expense (checking account) from the stored balance', () => {
    // storedBalance already had the future expense's delta (-165) applied,
    // so reversing it means adding 165 back.
    const result = computeCurrentBalance(
      835,
      [{ type: 'expense', amount: 165 }],
      makeAccount(),
    );
    expect(result).toBe(1000);
  });

  it('subtracts a future income from the stored balance', () => {
    const result = computeCurrentBalance(
      1200,
      [{ type: 'income', amount: 200 }],
      makeAccount(),
    );
    expect(result).toBe(1000);
  });

  it('inverts the sign for a credit account (expense increases stored debt balance)', () => {
    // A future expense on a credit card increases the stored balance
    // (debt) — reversing it means subtracting.
    const result = computeCurrentBalance(
      1165,
      [{ type: 'expense', amount: 165 }],
      makeAccount('credit'),
    );
    expect(result).toBe(1000);
  });

  it('sums the effect of multiple future transactions', () => {
    const result = computeCurrentBalance(
      1000 - 165 - 165 + 50,
      [
        { type: 'expense', amount: 165 },
        { type: 'expense', amount: 165 },
        { type: 'income', amount: 50 },
      ],
      makeAccount(),
    );
    expect(result).toBe(1000);
  });

  it('reverses a future transfer leg by subtracting its amount unconditionally', () => {
    // Matches DeleteTransactionUseCase's existing (pre-Round-2) convention —
    // see the spec's "Limitação conhecida".
    const result = computeCurrentBalance(
      1000 + 300,
      [{ type: 'transfer', amount: 300 }],
      makeAccount(),
    );
    expect(result).toBe(1000);
  });
});
