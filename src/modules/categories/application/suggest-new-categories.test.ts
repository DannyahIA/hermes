import { expect, it } from 'vitest';

import { Category } from '@/core/entities/category';
import { Transaction } from '@/core/entities/transaction';

import { suggestNewCategories } from './suggest-new-categories';

const USER_ID = 'user-1';
const DATE = new Date(2026, 9, 19, 12);

function transaction(
  id: string,
  description: string,
  overrides: Partial<ConstructorParameters<typeof Transaction>[0]> = {},
) {
  return new Transaction({
    id,
    accountId: 'card-1',
    description,
    amount: 20,
    type: 'expense',
    occurredAt: DATE,
    createdAt: DATE,
    updatedAt: DATE,
    ...overrides,
  });
}

function category(id: string, name: string, archived = false) {
  return new Category({
    id,
    userId: USER_ID,
    name,
    archived,
    createdAt: DATE,
    updatedAt: DATE,
  });
}

const farmacia = transaction('farmacia', 'FARMÁCIA SÃO JOÃO S/A');
const mercado = category('mercado', 'Mercado');
const saudeArquivada = category('saude', 'Saúde', true);
const farmaciaComCategoria = transaction(
  'farmacia-categorizada',
  'FARMÁCIA SÃO JOÃO S/A',
  { categoryId: 'saude' },
);
const transferencia = transaction('transferencia', 'FARMÁCIA SÃO JOÃO S/A', {
  type: 'transfer',
});
const pagamentoFatura = transaction('fatura', 'FARMÁCIA SÃO JOÃO S/A', {
  settlesAccountId: 'card-1',
});

it('suggests the missing category for a purchase without one', () => {
  expect(
    suggestNewCategories({
      transactions: [farmacia],
      categories: [mercado],
      rules: [],
    }),
  ).toEqual({
    [farmacia.id]: { key: 'saude', name: 'Saúde', color: expect.any(String) },
  });
});
it('suggests nothing the user already has, archived or not, nor for a remembered merchant', () => {
  expect(
    suggestNewCategories({
      transactions: [farmacia],
      categories: [saudeArquivada],
      rules: [],
    }),
  ).toEqual({});
  expect(
    suggestNewCategories({
      transactions: [farmacia],
      categories: [],
      rules: [{ merchantKey: 'farmacia sao joao' }],
    }),
  ).toEqual({});
});
it.each([
  ['com categoria', farmaciaComCategoria],
  ['transferência', transferencia],
  ['pagamento de fatura', pagamentoFatura],
  [
    'entrada',
    transaction('entrada', 'FARMÁCIA SÃO JOÃO S/A', { type: 'income' }),
  ],
])('skips a purchase %s', (_, transaction) => {
  expect(
    suggestNewCategories({
      transactions: [transaction],
      categories: [],
      rules: [],
    }),
  ).toEqual({});
});
