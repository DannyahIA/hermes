import { beforeEach, describe, expect, it } from 'vitest';

import { Budget } from '@/core/entities/budget';
import { Category } from '@/core/entities/category';
import {
  Transaction,
  type TransactionProps,
} from '@/core/entities/transaction';
import { formatCurrency } from '@/shared/lib/format-currency';
import { FakeBudgetRepository } from '@/tests/fakes/fake-budget.repository';
import { FakeBudgetAlertLog } from '@/tests/fakes/fake-budget-alert-log';
import { FakeCategoryRepository } from '@/tests/fakes/fake-category.repository';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';

import { CheckBudgetAlertsUseCase } from './check-budget-alerts.use-case';

const brl = formatCurrency;
const USER_ID = 'user-1';
/** Late enough in October that 75% is not ahead of the calendar. */
const OCTOBER = new Date(2026, 9, 25, 12);
const NOVEMBER = new Date(2026, 10, 25, 12);

function monthlyBudget(
  id: string,
  categoryId: string,
  amount: number,
  userId = USER_ID,
) {
  return new Budget({
    id,
    userId,
    categoryId,
    amount,
    currency: 'BRL',
    kind: 'monthly',
    limits: [],
    periodStart: new Date(2026, 9, 1),
    periodEnd: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function category(id: string, name: string) {
  return new Category({
    id,
    userId: USER_ID,
    name,
    archived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('CheckBudgetAlertsUseCase', () => {
  let transactions: FakeTransactionRepository;
  let budgets: FakeBudgetRepository;
  let categories: FakeCategoryRepository;
  let alertLog: FakeBudgetAlertLog;
  let useCase: CheckBudgetAlertsUseCase;

  async function purchase(
    id: string,
    amount: number,
    occurredAt: Date,
    overrides: Partial<TransactionProps> = {},
  ) {
    await transactions.save(
      new Transaction({
        id,
        accountId: 'acc-1',
        categoryId: 'mercado',
        description: 'Compra',
        amount,
        type: 'expense',
        occurredAt,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
      }),
    );
    return id;
  }

  function check(transactionIds: string[], now = OCTOBER, userId = USER_ID) {
    return useCase.execute({ userId, transactionIds, now });
  }

  beforeEach(async () => {
    transactions = new FakeTransactionRepository();
    budgets = new FakeBudgetRepository();
    categories = new FakeCategoryRepository();
    alertLog = new FakeBudgetAlertLog();
    useCase = new CheckBudgetAlertsUseCase(
      transactions,
      budgets,
      categories,
      alertLog,
    );
    await categories.save(category('mercado', 'Mercado'));
    await categories.save(category('lazer', 'Lazer'));
    await budgets.save(monthlyBudget('b-mercado', 'mercado', 500));
  });

  it('warns once when a purchase takes Mercado to 75%', async () => {
    const id = await purchase('p1', 375, new Date(2026, 9, 20));

    expect(await check([id])).toEqual([
      `Mercado: 75% do orçamento (${brl(375)} de ${brl(500)}).`,
    ]);
    expect(await check([id])).toEqual([]);
  });

  it('starts the stages over in a new month', async () => {
    const october = await purchase('p1', 375, new Date(2026, 9, 20));
    const november = await purchase('p2', 375, new Date(2026, 10, 20));

    expect(await check([october], OCTOBER)).toHaveLength(1);
    expect(await check([october], OCTOBER)).toEqual([]);
    expect(await check([november], NOVEMBER)).toEqual([
      `Mercado: 75% do orçamento (${brl(375)} de ${brl(500)}).`,
    ]);
  });

  it('says nothing for income, a transfer, a bill payment, or a purchase dated in a period that is over', async () => {
    // Enough already spent that any of these would warn if it counted.
    await purchase('base', 400, new Date(2026, 9, 3));
    const income = await purchase('income', 50, new Date(2026, 9, 20), {
      type: 'income',
    });
    const transfer = await purchase('transfer', 50, new Date(2026, 9, 20), {
      type: 'transfer',
    });
    const billPayment = await purchase('bill', 50, new Date(2026, 9, 20), {
      settlesAccountId: 'card-1',
    });
    const lastMonth = await purchase('old', 50, new Date(2026, 8, 20));
    const uncategorized = await purchase('none', 50, new Date(2026, 9, 20), {
      categoryId: undefined,
    });

    expect(
      await check([
        income,
        transfer,
        billPayment,
        lastMonth,
        uncategorized,
        'missing',
      ]),
    ).toEqual([]);
  });

  it('says nothing for a category without a running budget', async () => {
    const lazer = await purchase('p1', 900, new Date(2026, 9, 20), {
      categoryId: 'lazer',
    });
    expect(await check([lazer])).toEqual([]);

    // A monthly budget that only starts next month is not running yet.
    await budgets.save(
      new Budget({
        ...monthlyBudget('b-lazer', 'lazer', 100).props,
        periodStart: new Date(2026, 10, 1),
      }),
    );
    expect(await check([lazer])).toEqual([]);
  });

  it("leaves another user's budgets alone", async () => {
    await budgets.save(monthlyBudget('b-other', 'lazer', 100, 'user-2'));
    const lazer = await purchase('p1', 900, new Date(2026, 9, 20), {
      categoryId: 'lazer',
    });

    expect(await check([lazer])).toEqual([]);
  });

  it('tells every purchase how much it is over once past the limit', async () => {
    const first = await purchase('p1', 600, new Date(2026, 9, 20));

    expect(await check([first])).toEqual([
      `Mercado: ${brl(100)} acima do orçamento de ${brl(500)}.`,
    ]);
    const second = await purchase('p2', 50, new Date(2026, 9, 21));
    expect(await check([second])).toEqual([
      `Mercado: ${brl(150)} acima do orçamento de ${brl(500)}.`,
    ]);
    expect(await check([second])).toEqual([
      `Mercado: ${brl(150)} acima do orçamento de ${brl(500)}.`,
    ]);
  });

  it('keeps one alert when two calls claim the same stage', async () => {
    const id = await purchase('p1', 375, new Date(2026, 9, 20));

    const [a, b] = await Promise.all([check([id]), check([id])]);

    expect([...a, ...b]).toHaveLength(1);
  });

  it('gives a budget one line even when several purchases touch it', async () => {
    const a = await purchase('p1', 200, new Date(2026, 9, 20));
    const b = await purchase('p2', 175, new Date(2026, 9, 21));

    expect(await check([a, b])).toEqual([
      `Mercado: 75% do orçamento (${brl(375)} de ${brl(500)}).`,
    ]);
  });

  it('orders the lines by the purchases given', async () => {
    await budgets.save(monthlyBudget('b-lazer', 'lazer', 100));
    const mercado = await purchase('p1', 375, new Date(2026, 9, 20));
    const lazer = await purchase('p2', 80, new Date(2026, 9, 20), {
      categoryId: 'lazer',
    });

    expect(await check([lazer, mercado])).toEqual([
      `Lazer: 75% do orçamento (${brl(80)} de ${brl(100)}).`,
      `Mercado: 75% do orçamento (${brl(375)} de ${brl(500)}).`,
    ]);
  });

  it('does not let an undone purchase use up the stage', async () => {
    const quick = await purchase('p1', 375, new Date(2026, 9, 20));
    expect(await check([quick])).toHaveLength(1);

    // The purchase is undone; a small one below 75% re-arms the stages.
    await transactions.delete(quick);
    const small = await purchase('p2', 50, new Date(2026, 9, 21));
    expect(await check([small])).toEqual([]);
    expect(await alertLog.warned('b-mercado', new Date(2026, 9, 1))).toEqual(
      new Set(),
    );

    const real = await purchase('p3', 325, new Date(2026, 9, 22));
    expect(await check([real])).toEqual([
      `Mercado: 75% do orçamento (${brl(375)} de ${brl(500)}).`,
    ]);
  });

  it('keeps a stage warned while spending still reaches it', async () => {
    const first = await purchase('p1', 375, new Date(2026, 9, 20));
    expect(await check([first])).toHaveLength(1);

    const second = await purchase('p2', 10, new Date(2026, 9, 21));
    expect(await check([second])).toEqual([]);
    expect(await alertLog.warned('b-mercado', new Date(2026, 9, 1))).toEqual(
      new Set(['75', 'pace']),
    );
  });

  it('releases the pace warning when spending falls under half the limit', async () => {
    const early = new Date(2026, 9, 5, 12);
    const first = await purchase('p1', 300, new Date(2026, 9, 3));
    expect(await check([first], early)).toHaveLength(1);

    await transactions.delete(first);
    const small = await purchase('p2', 100, new Date(2026, 9, 4));
    expect(await check([small], early)).toEqual([]);
    expect(await alertLog.warned('b-mercado', new Date(2026, 9, 1))).toEqual(
      new Set(),
    );
  });
});
