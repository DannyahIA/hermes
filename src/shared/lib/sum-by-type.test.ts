import { describe, expect, it } from 'vitest';

import { Transaction } from '@/core/entities/transaction';

import { sumByType } from './sum-by-type';

function tx(type: Transaction['type'], amount: number) {
  return new Transaction({
    id: `${type}-${amount}`,
    accountId: 'acc-1',
    description: 'x',
    amount,
    type,
    occurredAt: new Date('2026-01-01'),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('sumByType', () => {
  it('sums only transactions matching the given type', () => {
    const transactions = [
      tx('income', 100),
      tx('expense', 40),
      tx('income', 20),
    ];
    expect(sumByType(transactions, 'income')).toBe(120);
    expect(sumByType(transactions, 'expense')).toBe(40);
  });

  it('skips a card bill payment, whose purchases were already counted on the card', () => {
    const payment = new Transaction({
      id: 'payment',
      accountId: 'acc-1',
      description: 'Pagamento de fatura',
      amount: 300,
      type: 'expense',
      settlesAccountId: 'card-1',
      occurredAt: new Date('2026-01-10'),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(sumByType([tx('expense', 40), payment], 'expense')).toBe(40);
  });

  it('returns 0 for an empty list', () => {
    expect(sumByType([], 'income')).toBe(0);
  });
});
