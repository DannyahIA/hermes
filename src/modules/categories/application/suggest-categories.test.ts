import { describe, expect, it } from 'vitest';

import { Transaction } from '@/core/entities/transaction';

import { createCategorySuggester } from './suggest-categories';

let sequence = 0;

function categorized(
  description: string,
  categoryId: string,
  day: number,
  type: 'income' | 'expense' = 'expense',
) {
  sequence += 1;
  return new Transaction({
    id: `tx-${sequence}`,
    accountId: 'card-1',
    categoryId,
    description,
    amount: 10,
    type,
    occurredAt: new Date(2026, 9, day, 12),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

const CATEGORIES = [
  'mercado',
  'restaurantes',
  'transporte',
  'lazer',
  'salario',
];

describe('createCategorySuggester', () => {
  it('leads with the category used for the same merchant, however it was spelled', () => {
    const suggest = createCategorySuggester({
      categoryIds: CATEGORIES,
      rules: [],
      history: [
        categorized('Supermercado Condor', 'mercado', 1),
        categorized('Supermercado Condor', 'mercado', 2),
        categorized('Uber', 'transporte', 3),
        categorized('PADARIA REAL LTDA *123', 'restaurantes', 4),
      ],
    });

    expect(suggest('Padaria Real', 'expense')).toEqual([
      'restaurantes',
      'mercado',
      'transporte',
    ]);
  });

  it('puts a remembered merchant rule ahead of history', () => {
    const suggest = createCategorySuggester({
      categoryIds: CATEGORIES,
      rules: [{ merchantKey: 'padaria real', categoryId: 'lazer' }],
      history: [categorized('Padaria Real', 'restaurantes', 4)],
    });

    expect(suggest('PADARIA REAL *99', 'expense')).toEqual([
      'lazer',
      'restaurantes',
    ]);
  });

  it('falls back to the most used categories, the most recent first on a tie', () => {
    const suggest = createCategorySuggester({
      categoryIds: CATEGORIES,
      rules: [],
      history: [
        categorized('Uber', 'transporte', 1),
        categorized('Cinemark', 'lazer', 9),
        categorized('Hortifruti', 'mercado', 2),
        categorized('Condor', 'mercado', 3),
      ],
    });

    expect(suggest('Posto Shell', 'expense')).toEqual([
      'mercado',
      'lazer',
      'transporte',
    ]);
  });

  it('keeps income and expense categories apart', () => {
    const suggest = createCategorySuggester({
      categoryIds: CATEGORIES,
      rules: [],
      history: [
        categorized('Salário', 'salario', 5, 'income'),
        categorized('Uber', 'transporte', 6),
      ],
    });

    expect(suggest('Pix recebido', 'income')).toEqual(['salario']);
    expect(suggest('Posto Shell', 'expense')).toEqual(['transporte']);
  });

  it('never suggests an archived or deleted category', () => {
    const suggest = createCategorySuggester({
      categoryIds: ['mercado'],
      rules: [{ merchantKey: 'padaria real', categoryId: 'restaurantes' }],
      history: [
        categorized('Padaria Real', 'restaurantes', 4),
        categorized('Condor', 'mercado', 3),
      ],
    });

    expect(suggest('Padaria Real', 'expense')).toEqual(['mercado']);
  });
});
