import { describe, expect, it } from 'vitest';

import { Budget } from '@/core/entities/budget';
import { Category } from '@/core/entities/category';
import { Transaction } from '@/core/entities/transaction';
import { ValidationError } from '@/core/errors/validation-error';
import { FakeBudgetRepository } from '@/tests/fakes/fake-budget.repository';
import { FakeCategoryRepository } from '@/tests/fakes/fake-category.repository';
import { FakeMerchantRuleRepository } from '@/tests/fakes/fake-merchant-rule.repository';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';

import { GetCategoriesOverviewUseCase } from './get-categories-overview.use-case';

const USER_ID = 'user-1';
const NOW = new Date(2026, 9, 20, 12);

/** Noon, `days` days before NOW (the day arithmetic wraps across months). */
function daysAgo(days: number): Date {
  return new Date(2026, 9, 20 - days, 12);
}

function makeCategory(
  id: string,
  name: string,
  createdAt: Date,
  overrides: { archived?: boolean; color?: string } = {},
): Category {
  return new Category({
    id,
    userId: USER_ID,
    name,
    archived: overrides.archived ?? false,
    color: overrides.color,
    createdAt,
    updatedAt: createdAt,
  });
}

function makeTransaction(
  id: string,
  description: string,
  occurredAt: Date,
  amount: number,
  overrides: Partial<ConstructorParameters<typeof Transaction>[0]> = {},
): Transaction {
  return new Transaction({
    id,
    accountId: 'card-1',
    description,
    amount,
    type: 'expense',
    occurredAt,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    ...overrides,
  });
}

function makeBudget(
  id: string,
  categoryId: string,
  periodStart: Date,
  periodEnd: Date,
  amount: number,
): Budget {
  return new Budget({
    id,
    userId: USER_ID,
    categoryId,
    amount,
    currency: 'BRL',
    periodStart,
    periodEnd,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function overviewUseCase(
  transactions: FakeTransactionRepository,
  categories: FakeCategoryRepository,
  budgets: FakeBudgetRepository = new FakeBudgetRepository(),
) {
  return new GetCategoriesOverviewUseCase(
    transactions,
    categories,
    new FakeMerchantRuleRepository(),
    budgets,
  );
}

/**
 * The shared data set: September and October 2026 and six categories. In
 * October, Mercado 1240 and Restaurantes 820.40; the uncategorized
 * purchases f1-f3 fall in September.
 */
async function buildFixture() {
  const transactions = new FakeTransactionRepository();
  const categories = new FakeCategoryRepository();
  const budgets = new FakeBudgetRepository();

  const mercado = makeCategory('mercado', 'Mercado', daysAgo(120));
  const supermercado = makeCategory(
    'supermercado',
    'Supermercado',
    daysAgo(100),
  );
  const restaurantes = makeCategory(
    'restaurantes',
    'Restaurantes',
    daysAgo(150),
  );
  const salario = makeCategory('salario', 'Salário', daysAgo(150), {
    color: '#22c55e',
  });
  const lazer = makeCategory('lazer', 'Lazer', daysAgo(90));
  const pets = makeCategory('pets', 'Pets', daysAgo(1));
  for (const category of [
    mercado,
    supermercado,
    restaurantes,
    salario,
    lazer,
    pets,
  ]) {
    await categories.save(category);
  }

  const farmacia = [
    makeTransaction('f1', 'Farmácia São João', new Date(2026, 8, 3, 12), 120),
    makeTransaction('f2', 'Drogasil 24h', new Date(2026, 8, 14, 12), 99.9),
    makeTransaction('f3', 'Farmácia Popular', new Date(2026, 8, 22, 12), 136.8),
  ];
  const others = [
    makeTransaction(
      'm1',
      'MERCADO CONDOR *0123',
      new Date(2026, 8, 12, 12),
      1000,
      { categoryId: 'mercado' },
    ),
    makeTransaction(
      'm2',
      'MERCADO CONDOR *0456',
      new Date(2026, 9, 5, 12),
      900,
      { categoryId: 'mercado' },
    ),
    makeTransaction('m3', 'Hortifruti Verde', new Date(2026, 9, 12, 12), 340, {
      categoryId: 'mercado',
    }),
    makeTransaction(
      'r1',
      'Restaurante Sabor',
      new Date(2026, 9, 15, 12),
      820.4,
      {
        categoryId: 'restaurantes',
      },
    ),
    makeTransaction('s1', 'SALARIO ACME LTDA', new Date(2026, 9, 5, 12), 5000, {
      type: 'income',
      categoryId: 'salario',
    }),
    makeTransaction('sm1', 'SUPERMERCADO BOM PRECO', daysAgo(30), 200, {
      categoryId: 'supermercado',
    }),
    makeTransaction('sm2', 'SUPERMERCADO BOM PRECO *77', daysAgo(22), 150, {
      categoryId: 'supermercado',
    }),
    makeTransaction('l1', 'Cinema Center', daysAgo(61), 60, {
      categoryId: 'lazer',
    }),
  ];
  for (const transaction of [...farmacia, ...others]) {
    await transactions.save(transaction);
  }

  return {
    get: overviewUseCase(transactions, categories, budgets),
    budgets,
    mercado,
    supermercado,
    lazer,
    farmacia,
  };
}

/** Every number in a value, nested ones included. */
function numbersIn(value: unknown): number[] {
  if (typeof value === 'number') return [value];
  if (Array.isArray(value)) return value.flatMap(numbersIn);
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(numbersIn);
  }
  return [];
}

describe('GetCategoriesOverviewUseCase', () => {
  it('totals the month per category, with its share and the change from the month before', async () => {
    const { get } = await buildFixture();

    const overview = await get.execute({
      userId: USER_ID,
      month: '2026-10',
      now: NOW,
    });

    expect(
      overview.rows.slice(0, 2).map((r) => [r.name, r.spent, r.deltaPercent]),
    ).toEqual([
      ['Mercado', 1240, 24],
      ['Restaurantes', 820.4, null],
    ]);
    expect(overview.rows.slice(2).map((r) => [r.name, r.spent])).toEqual([
      ['Lazer', 0],
      ['Pets', 0],
      ['Supermercado', 0],
    ]);
    expect(overview.rows[0].share).toBeCloseTo(1240 / 2060.4);
  });

  it('counts six months, the selected one last', async () => {
    const { get } = await buildFixture();

    const overview = await get.execute({
      userId: USER_ID,
      month: '2026-10',
      now: NOW,
    });

    expect(overview.rows[0].months).toEqual([0, 0, 0, 0, 1000, 1240]);
  });

  it('lists where the month was spent most', async () => {
    const { get } = await buildFixture();

    const overview = await get.execute({
      userId: USER_ID,
      month: '2026-10',
      now: NOW,
    });

    expect(overview.rows[0].topMerchants[0]).toEqual({
      name: 'Mercado Condor',
      total: 900,
    });
  });

  it('keeps income-only categories apart', async () => {
    const { get } = await buildFixture();

    const overview = await get.execute({
      userId: USER_ID,
      month: '2026-10',
      now: NOW,
    });

    expect(overview.incomeRows.map((r) => r.name)).toEqual(['Salário']);
  });

  it('shows zero and no change for a month without spending', async () => {
    const { get } = await buildFixture();

    const empty = await get.execute({
      userId: USER_ID,
      month: '2026-01',
      now: NOW,
    });

    expect([empty.spent, empty.deltaPercent]).toEqual([0, null]);
  });

  it('suggests creating the missing category with the purchases it would take', async () => {
    const { get, farmacia } = await buildFixture();

    const overview = await get.execute({
      userId: USER_ID,
      month: '2026-10',
      now: NOW,
    });

    expect(overview.suggestions.create).toEqual([
      {
        key: 'saude',
        name: 'Saúde',
        color: expect.any(String),
        transactionIds: farmacia.map((t) => t.id),
        total: 356.7,
      },
    ]);
  });

  it('suggests archiving a category unused for 60 days, not a new one', async () => {
    const { get, lazer } = await buildFixture();

    // Lazer: created 90 days ago, last purchase 61 days ago. Pets: created yesterday.
    const overview = await get.execute({
      userId: USER_ID,
      month: '2026-10',
      now: NOW,
    });

    expect(overview.suggestions.archive).toEqual([
      { categoryId: lazer.id, name: 'Lazer' },
    ]);
  });

  it('suggests merging look-alike categories, keeping the busier one', async () => {
    const { get, mercado, supermercado } = await buildFixture();

    const overview = await get.execute({
      userId: USER_ID,
      month: '2026-10',
      now: NOW,
    });

    expect(overview.suggestions.merge).toEqual([
      {
        keepId: mercado.id,
        keepName: 'Mercado',
        mergeId: supermercado.id,
        mergeName: 'Supermercado',
        mergeCount: 2,
      },
    ]);
  });

  it('counts an uncategorized purchase in the spending, apart from the categories', async () => {
    const transactions = new FakeTransactionRepository();
    const categories = new FakeCategoryRepository();
    await categories.save(makeCategory('mercado', 'Mercado', daysAgo(60)));
    await transactions.save(
      makeTransaction('m1', 'Mercado Condor', daysAgo(16), 100, {
        categoryId: 'mercado',
      }),
    );
    await transactions.save(
      makeTransaction('p1', 'Padaria Real', daysAgo(14), 45),
    );

    const overview = await overviewUseCase(transactions, categories).execute({
      userId: USER_ID,
      month: '2026-10',
      now: NOW,
    });

    expect([overview.spent, overview.uncategorized]).toEqual([145, 45]);
    expect(overview.rows.map((r) => r.spent)).toEqual([100]);
  });

  it('takes a row budget from a budget that overlaps the month', async () => {
    const { get, budgets, mercado } = await buildFixture();
    // Starts in September and ends on the 10th: it still covers October.
    await budgets.save(
      makeBudget(
        'budget-overlap',
        mercado.id,
        new Date(2026, 8, 25),
        new Date(2026, 9, 10, 23, 59, 59, 999),
        1500,
      ),
    );

    const overview = await get.execute({
      userId: USER_ID,
      month: '2026-10',
      now: NOW,
    });

    // Only the October 5 purchase falls inside the budget's period.
    expect(overview.rows[0].budget).toEqual({ spent: 900, amount: 1500 });
  });

  it('takes no row budget from a budget that ended before the month', async () => {
    const { get, budgets, mercado } = await buildFixture();
    await budgets.save(
      makeBudget(
        'budget-old',
        mercado.id,
        new Date(2026, 7, 1),
        new Date(2026, 7, 31, 23, 59, 59, 999),
        800,
      ),
    );

    const overview = await get.execute({
      userId: USER_ID,
      month: '2026-10',
      now: NOW,
    });

    expect(overview.rows[0].budget).toBeNull();
  });

  it('takes the budget that started latest when several cover the month', async () => {
    const { get, budgets, mercado } = await buildFixture();
    await budgets.save(
      makeBudget(
        'budget-early',
        mercado.id,
        new Date(2026, 8, 25),
        new Date(2026, 9, 31, 23, 59, 59, 999),
        1500,
      ),
    );
    await budgets.save(
      makeBudget(
        'budget-late',
        mercado.id,
        new Date(2026, 9, 1),
        new Date(2026, 9, 31, 23, 59, 59, 999),
        2000,
      ),
    );

    const overview = await get.execute({
      userId: USER_ID,
      month: '2026-10',
      now: NOW,
    });

    expect(overview.rows[0].budget).toEqual({ spent: 1240, amount: 2000 });
  });

  it('does not suggest archiving a category with a budget still running, even when unused', async () => {
    const transactions = new FakeTransactionRepository();
    const categories = new FakeCategoryRepository();
    const budgets = new FakeBudgetRepository();
    await categories.save(makeCategory('lazer', 'Lazer', daysAgo(90)));
    await transactions.save(
      makeTransaction('l1', 'Cinema Center', daysAgo(61), 60, {
        categoryId: 'lazer',
      }),
    );
    await budgets.save(
      makeBudget(
        'budget-lazer',
        'lazer',
        new Date(2026, 9, 1),
        new Date(2026, 10, 30, 23, 59, 59, 999),
        300,
      ),
    );

    const overview = await overviewUseCase(
      transactions,
      categories,
      budgets,
    ).execute({
      userId: USER_ID,
      month: '2026-10',
      now: NOW,
    });

    expect(overview.suggestions.archive).toEqual([]);
  });

  it('has no NaN or Infinity, and a zero share, in a month without spending', async () => {
    const { get } = await buildFixture();

    const empty = await get.execute({
      userId: USER_ID,
      month: '2026-01',
      now: NOW,
    });

    expect(empty.rows.length).toBeGreaterThan(0);
    expect(numbersIn(empty).every(Number.isFinite)).toBe(true);
    expect(empty.rows.every((r) => r.share === 0)).toBe(true);
  });

  it('lists archived categories apart, and never in the rows', async () => {
    const transactions = new FakeTransactionRepository();
    const categories = new FakeCategoryRepository();
    await categories.save(
      makeCategory('antiga', 'Antiga', daysAgo(200), {
        archived: true,
        color: '#64748b',
      }),
    );
    await transactions.save(
      makeTransaction('a1', 'Loja X', daysAgo(10), 40, {
        categoryId: 'antiga',
      }),
    );

    const overview = await overviewUseCase(transactions, categories).execute({
      userId: USER_ID,
      month: '2026-10',
      now: NOW,
    });

    expect(overview.archived).toEqual([
      { id: 'antiga', name: 'Antiga', color: '#64748b' },
    ]);
    expect(overview.rows).toEqual([]);
    expect(overview.spent).toBe(40);
  });

  it('rejects a month that is not YYYY-MM', async () => {
    const { get } = await buildFixture();

    await expect(
      get.execute({ userId: USER_ID, month: '2026-13', now: NOW }),
    ).rejects.toThrow(ValidationError);
  });
});
