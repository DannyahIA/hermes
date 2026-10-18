import { describe, expect, it } from 'vitest';

import { Transaction } from '@/core/entities/transaction';

import { buildMerchantMemory, recallMerchant } from './merchant-memory';

let sequence = 0;

function entry(
  description: string,
  overrides: Partial<{
    categoryId: string;
    accountId: string;
    type: 'income' | 'expense' | 'transfer';
    day: number;
    settlesAccountId: string;
  }> = {},
) {
  sequence += 1;
  return new Transaction({
    id: `tx-${sequence}`,
    accountId: overrides.accountId ?? 'card',
    categoryId: overrides.categoryId,
    description,
    amount: 10,
    type: overrides.type ?? 'expense',
    settlesAccountId: overrides.settlesAccountId,
    occurredAt: new Date(2026, 9, overrides.day ?? 1, 12),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

const AVAILABLE = {
  categoryIds: ['mercado', 'restaurantes', 'transporte', 'salario'],
  accountIds: ['card', 'checking'],
};

describe('buildMerchantMemory', () => {
  it('remembers the category, the kind and the account used most at each merchant', () => {
    const memory = buildMerchantMemory({
      ...AVAILABLE,
      rules: [],
      history: [
        entry('Uber', { categoryId: 'transporte' }),
        entry('UBER *TRIP', { categoryId: 'transporte', day: 2 }),
        entry('Uber', { accountId: 'checking', day: 3 }),
        entry('Salário', {
          categoryId: 'salario',
          type: 'income',
          accountId: 'checking',
        }),
      ],
    });

    expect(memory).toEqual([
      {
        key: 'salario',
        displayName: 'Salário',
        categoryId: 'salario',
        type: 'income',
        accountId: 'checking',
      },
      {
        key: 'uber',
        displayName: 'Uber',
        categoryId: 'transporte',
        type: 'expense',
        accountId: 'card',
      },
    ]);
  });

  it('lets a merchant rule decide the category and the name', () => {
    const memory = buildMerchantMemory({
      ...AVAILABLE,
      rules: [
        {
          merchantKey: 'padaria real',
          displayName: 'Padaria Real',
          categoryId: 'mercado',
        },
      ],
      history: [
        entry('PADARIA REAL LTDA *123', { categoryId: 'restaurantes' }),
      ],
    });

    expect(memory).toEqual([
      {
        key: 'padaria real',
        displayName: 'Padaria Real',
        categoryId: 'mercado',
        type: 'expense',
        accountId: 'card',
      },
    ]);
  });

  it('forgets transfers, bill payments, and categories or accounts no longer in use', () => {
    const memory = buildMerchantMemory({
      ...AVAILABLE,
      rules: [
        {
          merchantKey: 'cinemark',
          displayName: 'Cinemark',
          categoryId: 'lazer-arquivada',
        },
      ],
      history: [
        entry('Para a reserva', { type: 'transfer' }),
        entry('Pagamento de fatura', {
          accountId: 'checking',
          settlesAccountId: 'card',
        }),
        entry('Cinemark', { accountId: 'conta-arquivada' }),
      ],
    });

    expect(memory).toEqual([]);
  });
});

describe('recallMerchant', () => {
  const memory = buildMerchantMemory({
    ...AVAILABLE,
    rules: [],
    history: [
      entry('Padaria Real', { categoryId: 'restaurantes' }),
      entry('Supermercado Condor', { categoryId: 'mercado' }),
      entry('Posto Ipiranga', { categoryId: 'transporte' }),
      entry('Posto Shell', { categoryId: 'transporte', accountId: 'checking' }),
      entry('Mercado Livre', { categoryId: 'restaurantes' }),
      entry('Mercado Pago', { categoryId: 'mercado' }),
    ],
  });

  it('finds a merchant however it is spelled', () => {
    expect(recallMerchant(memory, 'PADARIA REAL *99')?.categoryId).toBe(
      'restaurantes',
    );
  });

  it('gives back the name a merchant was written with before', () => {
    expect(recallMerchant(memory, 'padaria real')?.displayName).toBe(
      'Padaria Real',
    );
  });

  it('takes a short name for the known merchant it belongs to', () => {
    expect(recallMerchant(memory, 'condor')).toEqual({
      key: 'condor',
      categoryId: 'mercado',
      type: 'expense',
      accountId: 'card',
    });
  });

  it('keeps only what every match agrees on', () => {
    expect(recallMerchant(memory, 'posto')).toEqual({
      key: 'posto',
      categoryId: 'transporte',
      type: 'expense',
    });
    expect(recallMerchant(memory, 'mercado')).toEqual({
      key: 'mercado',
      type: 'expense',
      accountId: 'card',
    });
  });

  it('does not guess from a fragment of a word or from nothing', () => {
    expect(recallMerchant(memory, 'super')).toBeNull();
    expect(recallMerchant(memory, 'Cinemark')).toBeNull();
    expect(recallMerchant(memory, '')).toBeNull();
  });
});
