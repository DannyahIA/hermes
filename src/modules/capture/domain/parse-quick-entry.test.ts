import { describe, expect, it } from 'vitest';

import type { MerchantMemoryEntry } from './merchant-memory';
import {
  parseQuickEntry,
  type QuickEntryAccount,
  type QuickEntryContext,
} from './parse-quick-entry';

/** Sunday, 18 Oct 2026, 10:02. */
const NOW = new Date(2026, 9, 18, 10, 2);

const ACCOUNTS: QuickEntryAccount[] = [
  {
    id: 'nubank-conta',
    name: 'Nubank Conta',
    type: 'checking',
    uses: { expense: 6, income: 2 },
  },
  {
    id: 'nubank-credito',
    name: 'Nubank Crédito',
    type: 'credit',
    uses: { expense: 40, income: 0 },
  },
  {
    id: 'itau-credito',
    name: 'Itaú Crédito',
    type: 'credit',
    uses: { expense: 3, income: 0 },
  },
  {
    id: 'reserva',
    name: 'Reserva de emergência',
    type: 'savings',
    uses: { expense: 0, income: 1 },
  },
];

const CATEGORIES = [
  { id: 'mercado', name: 'Mercado' },
  { id: 'restaurantes', name: 'Restaurantes' },
  { id: 'transporte', name: 'Transporte' },
  { id: 'salario', name: 'Salário' },
  { id: 'farmacia', name: 'Farmácia' },
];

const MERCHANTS: MerchantMemoryEntry[] = [
  {
    key: 'almoco',
    categoryId: 'restaurantes',
    type: 'expense',
    accountId: 'nubank-credito',
  },
  {
    key: 'uber',
    categoryId: 'transporte',
    type: 'expense',
    accountId: 'nubank-credito',
  },
  {
    key: 'salario',
    categoryId: 'salario',
    type: 'income',
    accountId: 'nubank-conta',
  },
  {
    key: 'padaria real',
    displayName: 'Padaria Real',
    categoryId: 'restaurantes',
    type: 'expense',
    accountId: 'nubank-credito',
  },
  {
    key: 'supermercado condor',
    categoryId: 'mercado',
    type: 'expense',
    accountId: 'nubank-credito',
  },
];

const CONTEXT: QuickEntryContext = {
  now: NOW,
  accounts: ACCOUNTS,
  categories: CATEGORIES,
  merchants: MERCHANTS,
};

function parse(text: string, context: Partial<QuickEntryContext> = {}) {
  return parseQuickEntry(text, { ...CONTEXT, ...context });
}

describe('parseQuickEntry', () => {
  describe('the examples in the spec', () => {
    it.each([
      [
        'almoço 32,50 crédito',
        {
          description: 'Almoço',
          amount: 32.5,
          type: 'expense',
          accountId: 'nubank-credito',
          categoryId: 'restaurantes',
          occurredAt: NOW,
          issues: [],
        },
      ],
      [
        'uber 18 débito',
        {
          description: 'Uber',
          amount: 18,
          type: 'expense',
          accountId: 'nubank-conta',
          categoryId: 'transporte',
          occurredAt: NOW,
          issues: [],
        },
      ],
      [
        '+3000 salário',
        {
          description: 'Salário',
          amount: 3000,
          type: 'income',
          accountId: 'nubank-conta',
          categoryId: 'salario',
          occurredAt: NOW,
          issues: [],
        },
      ],
      [
        'recebi 3000 salário',
        {
          description: 'Salário',
          amount: 3000,
          type: 'income',
          accountId: 'nubank-conta',
          categoryId: 'salario',
          occurredAt: NOW,
          issues: [],
        },
      ],
      [
        'mercado 250,40 ontem',
        {
          description: 'Mercado',
          amount: 250.4,
          type: 'expense',
          accountId: 'nubank-credito',
          categoryId: 'mercado',
          occurredAt: new Date(2026, 9, 17),
          issues: [],
        },
      ],
      [
        'farmácia 89,90 itaú',
        {
          description: 'Farmácia',
          amount: 89.9,
          type: 'expense',
          accountId: 'itau-credito',
          categoryId: 'farmacia',
          occurredAt: NOW,
          issues: [],
        },
      ],
    ])('understands %j', (text, expected) => {
      expect(parse(text)).toEqual(expected);
    });
  });

  describe('the amount', () => {
    it.each([
      ['almoço R$ 32,50', 32.5],
      ['almoço R$32,50', 32.5],
      ['almoço 1.234,56', 1234.56],
      ['almoço 32.5', 32.5],
      ['almoço 32 reais', 32],
      ['almoço 32,50.', 32.5],
    ])('reads %j as %d', (text, amount) => {
      const entry = parse(text);
      expect(entry.amount).toBe(amount);
      expect(entry.description).toBe('Almoço');
      expect(entry.issues).toEqual([]);
    });

    it('prefers the number written as money and keeps the rest in the description', () => {
      expect(parse('99 taxi 23,50')).toMatchObject({
        description: '99 taxi',
        amount: 23.5,
        issues: [],
      });
    });

    it('takes the last number when nothing tells them apart, and says so', () => {
      expect(parse('2 cafés 9')).toMatchObject({
        description: '2 cafés',
        amount: 9,
        issues: [{ code: 'several-amounts', ignored: [2] }],
      });
      expect(parse('almoço 32,50 45,00')).toMatchObject({
        amount: 45,
        issues: [{ code: 'several-amounts', ignored: [32.5] }],
      });
    });

    it('takes a sign written apart from the number', () => {
      expect(parse('+ 3000 salário')).toMatchObject({
        amount: 3000,
        type: 'income',
      });
    });

    it('lets a minus sign win over what the merchant usually is', () => {
      expect(parse('-3000 salário').type).toBe('expense');
    });

    it('asks for the amount when there is none, or it reads as nothing', () => {
      expect(parse('almoço').issues).toEqual([{ code: 'missing-amount' }]);
      expect(parse('almoço 0').issues).toEqual([{ code: 'missing-amount' }]);
      expect(parse('almoço 32,505')).toMatchObject({
        amount: null,
        description: 'Almoço 32,505',
        issues: [{ code: 'missing-amount' }],
      });
    });
  });

  describe('the date', () => {
    it.each([
      ['mercado 250 hoje', NOW],
      ['mercado 250 ontem', new Date(2026, 9, 17)],
      ['mercado 250 anteontem', new Date(2026, 9, 16)],
      ['aluguel 1800 amanhã', new Date(2026, 9, 19)],
      ['mercado 250 12/10', new Date(2026, 9, 12)],
      ['mercado 250 de 12/10', new Date(2026, 9, 12)],
      ['mercado 250 31/12/2025', new Date(2025, 11, 31)],
      ['mercado 250 31/12/25', new Date(2025, 11, 31)],
      // The nearest 25/12 is the coming one.
      ['presente 120 25/12', new Date(2026, 11, 25)],
      ['mercado 250 dia 12', new Date(2026, 9, 12)],
      ['mercado 250 no dia 12', new Date(2026, 9, 12)],
      // The 25th hasn't come yet this month: the last one was in September.
      ['mercado 250 dia 25', new Date(2026, 8, 25)],
      // September has no 31st.
      ['mercado 250 dia 31', new Date(2026, 7, 31)],
      ['dia 12 mercado 250', new Date(2026, 9, 12)],
      ['mercado 250 18/10', NOW],
    ])('reads %j', (text, occurredAt) => {
      const entry = parse(text);
      expect(entry.occurredAt).toEqual(occurredAt);
      expect(entry.amount).not.toBeNull();
      expect(['Mercado', 'Aluguel', 'Presente']).toContain(entry.description);
    });

    it('leaves what only looks like a date in the description', () => {
      expect(parse('dia dos pais 150')).toMatchObject({
        description: 'Dia dos pais',
        amount: 150,
        occurredAt: NOW,
      });
      expect(parse('ingresso 31/02 80').description).toBe('Ingresso 31/02');
    });
  });

  describe('the account', () => {
    it.each([
      ['almoço 32 nubank crédito', 'nubank-credito'],
      ['almoço 32 no nubank crédito', 'nubank-credito'],
      ['almoço 32 no crédito', 'nubank-credito'],
      ['almoço 32 no cartão', 'nubank-credito'],
      ['almoço 32 itaú', 'itau-credito'],
      ['almoço 32 itaú crédito', 'itau-credito'],
      ['almoço 32 pix', 'nubank-conta'],
      ['almoço 32 dinheiro', 'nubank-conta'],
      ['almoço 32 poupança', 'reserva'],
      ['almoço 32 reserva de emergência', 'reserva'],
    ])('reads %j', (text, accountId) => {
      expect(parse(text)).toMatchObject({
        description: 'Almoço',
        accountId,
      });
    });

    it('picks the most used account a bank name could mean', () => {
      expect(parse('lanche 32 nubank').accountId).toBe('nubank-credito');
      expect(parse('+50 reembolso nubank').accountId).toBe('nubank-conta');
    });

    it('narrows a bank name down with the kind of account', () => {
      expect(parse('lanche 32 nubank débito').accountId).toBe('nubank-conta');
    });

    it('goes where the merchant usually goes, unless the text says otherwise', () => {
      expect(parse('uber 18').accountId).toBe('nubank-credito');
      expect(parse('uber 18 pix').accountId).toBe('nubank-conta');
    });

    it('falls back to the account used most for that kind of entry', () => {
      expect(parse('lanche 32').accountId).toBe('nubank-credito');
      expect(parse('+50 reembolso').accountId).toBe('nubank-conta');
    });

    it('ignores a kind of account the person does not have', () => {
      const noCards = ACCOUNTS.filter((account) => account.type !== 'credit');
      expect(parse('lanche 32 crédito', { accounts: noCards })).toMatchObject({
        description: 'Lanche',
        accountId: 'nubank-conta',
      });
    });

    it('does not mistake a word of the description for an account', () => {
      expect(parse('conta de luz 120')).toMatchObject({
        description: 'Conta de luz',
        accountId: 'nubank-credito',
      });
    });

    it('says when there is no account to record it in', () => {
      expect(parse('almoço 32', { accounts: [] })).toMatchObject({
        accountId: null,
        issues: [{ code: 'no-account' }],
      });
    });
  });

  describe('the description and category', () => {
    it('uses the name kept for a known merchant', () => {
      expect(parse('padaria real 12')).toMatchObject({
        description: 'Padaria Real',
        categoryId: 'restaurantes',
      });
    });

    it('recognizes a short name for a known merchant', () => {
      expect(parse('condor 120')).toMatchObject({
        description: 'Condor',
        categoryId: 'mercado',
      });
    });

    it('files under the category the description names', () => {
      expect(parse('restaurante 80').categoryId).toBe('restaurantes');
      expect(parse('farmacia 30').categoryId).toBe('farmacia');
    });

    it('leaves the category out for something new', () => {
      expect(parse('cinema 40')).toMatchObject({
        description: 'Cinema',
        categoryId: null,
      });
    });

    it('never files under a category that can no longer take entries', () => {
      expect(
        parse('almoço 32', {
          categories: CATEGORIES.filter(({ id }) => id !== 'restaurantes'),
        }).categoryId,
      ).toBeNull();
    });

    it('keeps the capitals someone typed, and capitalizes the rest', () => {
      expect(parse('iFood 45').description).toBe('iFood');
      expect(parse('café com leite 8 pix').description).toBe('Café com leite');
      expect(parse('UBER 18').description).toBe('UBER');
    });

    it('drops the little words left hanging at the ends', () => {
      expect(parse('uber no débito 18').description).toBe('Uber');
      expect(parse('almoço de 32 ontem').description).toBe('Almoço');
    });

    it('asks what it was when only an amount was given', () => {
      expect(parse('32,50 crédito')).toMatchObject({
        description: '',
        amount: 32.5,
        issues: [{ code: 'missing-description' }],
      });
    });

    it('takes extra spaces and a trailing comma in stride', () => {
      expect(parse('  almoço,   32,50  ')).toMatchObject({
        description: 'Almoço',
        amount: 32.5,
      });
    });
  });
});
