import { describe, expect, it } from 'vitest';

import { ValidationError } from '@/core/errors/validation-error';

import { Transaction } from './transaction';

function makeProps(
  overrides: Partial<ConstructorParameters<typeof Transaction>[0]> = {},
) {
  return {
    id: 'tx-1',
    accountId: 'acc-1',
    description: 'Compra',
    amount: 10,
    type: 'expense' as const,
    occurredAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('Transaction', () => {
  it('rejects an amount of zero (invariant: must be greater than zero)', () => {
    expect(() => new Transaction(makeProps({ amount: 0 }))).toThrow(
      ValidationError,
    );
  });

  it('rejects a negative amount', () => {
    expect(() => new Transaction(makeProps({ amount: -5 }))).toThrow(
      ValidationError,
    );
  });

  it('rejects a blank description', () => {
    expect(() => new Transaction(makeProps({ description: '  ' }))).toThrow(
      ValidationError,
    );
  });

  it('accepts a valid transaction', () => {
    const transaction = new Transaction(makeProps());
    expect(transaction.amount).toBe(10);
  });
});
