import { describe, expect, it } from 'vitest';

import { Category } from '@/core/entities/category';
import { MerchantRule } from '@/core/entities/merchant-rule';
import { Transaction } from '@/core/entities/transaction';
import { FakeCategoryRepository } from '@/tests/fakes/fake-category.repository';
import { FakeMerchantRuleRepository } from '@/tests/fakes/fake-merchant-rule.repository';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';

import { GetCategorySuggestionsUseCase } from './get-category-suggestions.use-case';

const USER_ID = 'user-1';
const NOW = new Date(2026, 9, 19, 12);

function transaction(
  id: string,
  description: string,
  daysAgo: number,
  overrides: Partial<ConstructorParameters<typeof Transaction>[0]> = {},
) {
  return new Transaction({
    id,
    accountId: 'card-1',
    description,
    amount: 20,
    type: 'expense',
    occurredAt: new Date(2026, 9, 19 - daysAgo, 12),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

describe('GetCategorySuggestionsUseCase', () => {
  it('suggests for what still takes a category, from rules and recent history', async () => {
    const transactions = new FakeTransactionRepository();
    const categories = new FakeCategoryRepository();
    const rules = new FakeMerchantRuleRepository();
    for (const [id, archived] of [
      ['restaurantes', false],
      ['transporte', false],
      ['antiga', true],
    ] as const) {
      await categories.save(
        new Category({
          id,
          userId: USER_ID,
          name: id,
          archived,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );
    }
    await rules.save(
      new MerchantRule({
        id: 'rule-1',
        userId: USER_ID,
        merchantKey: 'uber',
        displayName: 'Uber',
        categoryId: 'transporte',
        hits: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    await transactions.save(
      transaction('filed', 'Padaria Real', 3, { categoryId: 'restaurantes' }),
    );
    await transactions.save(
      transaction('too-old', 'Padaria Real', 120, { categoryId: 'antiga' }),
    );

    const page = [
      transaction('padaria', 'PADARIA REAL *12', 0),
      transaction('uber', 'Uber *trip', 0),
      transaction('done', 'Padaria Real', 0, { categoryId: 'restaurantes' }),
      transaction('transfer', 'Para a reserva', 0, { type: 'transfer' }),
      transaction('bill', 'Pagamento de fatura', 0, {
        settlesAccountId: 'card-1',
      }),
    ];

    const { categories: suggestions } = await new GetCategorySuggestionsUseCase(
      transactions,
      categories,
      rules,
    ).execute({ userId: USER_ID, transactions: page, now: NOW });

    expect(suggestions).toEqual({
      padaria: ['restaurantes'],
      uber: ['transporte', 'restaurantes'],
    });
  });

  it('suggests a common category the user does not have yet, beside the existing suggestions', async () => {
    const transactions = new FakeTransactionRepository();
    const categories = new FakeCategoryRepository();
    const rules = new FakeMerchantRuleRepository();
    await categories.save(
      new Category({
        id: 'restaurantes',
        userId: USER_ID,
        name: 'Restaurantes',
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    await transactions.save(
      transaction('filed', 'Padaria Real', 3, { categoryId: 'restaurantes' }),
    );

    const result = await new GetCategorySuggestionsUseCase(
      transactions,
      categories,
      rules,
    ).execute({
      userId: USER_ID,
      transactions: [
        transaction('padaria', 'PADARIA REAL *12', 0),
        transaction('farmacia', 'Farmácia São João', 0),
      ],
      now: NOW,
    });

    expect(result.categories.padaria).toEqual(['restaurantes']);
    expect(result.newCategories.farmacia).toEqual({
      key: 'saude',
      name: 'Saúde',
      color: '#ef4444',
    });
    expect(result.newCategories.padaria).toBeUndefined();
  });

  it('reads nothing when every row already has a category or takes none', async () => {
    const transactions = new FakeTransactionRepository();
    let reads = 0;
    transactions.findByUserId = async () => {
      reads += 1;
      return [];
    };

    const suggestions = await new GetCategorySuggestionsUseCase(
      transactions,
      new FakeCategoryRepository(),
      new FakeMerchantRuleRepository(),
    ).execute({
      userId: USER_ID,
      transactions: [
        transaction('transfer', 'Para a reserva', 0, { type: 'transfer' }),
      ],
      now: NOW,
    });

    expect(suggestions).toEqual({ categories: {}, newCategories: {} });
    expect(reads).toBe(0);
  });
});
