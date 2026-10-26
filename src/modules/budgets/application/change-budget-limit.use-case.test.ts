import { describe, expect, it } from 'vitest';

import { Budget } from '@/core/entities/budget';
import { NotFoundError } from '@/core/errors/not-found-error';
import { FakeBudgetRepository } from '@/tests/fakes/fake-budget.repository';

import { ChangeBudgetLimitUseCase } from './change-budget-limit.use-case';

const USER = 'user-1';
const BUDGET_ID = 'budget-1';

function monthly(userId = USER) {
  return new Budget({
    id: BUDGET_ID,
    userId,
    categoryId: 'mercado',
    amount: 500,
    currency: 'BRL',
    kind: 'monthly',
    limits: [],
    periodStart: new Date(2026, 8, 1),
    periodEnd: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('ChangeBudgetLimitUseCase', () => {
  it('changes a monthly limit from this month on', async () => {
    const budgets = new FakeBudgetRepository();
    await budgets.save(monthly());

    await new ChangeBudgetLimitUseCase(budgets).execute({
      userId: USER,
      budgetId: BUDGET_ID,
      amount: 700,
      now: new Date(2026, 10, 15),
    });

    const saved = await budgets.findById(BUDGET_ID);
    expect(saved?.amountFor(new Date(2026, 9, 10))).toBe(500);
    expect(saved?.amountFor(new Date(2026, 10, 10))).toBe(700);
  });

  it('replaces the limit of a budget with dates', async () => {
    const budgets = new FakeBudgetRepository();
    await budgets.save(
      new Budget({
        ...monthly().props,
        kind: 'fixed',
        periodStart: new Date(2026, 9, 1),
        periodEnd: new Date(2026, 9, 31, 23, 59, 59, 999),
      }),
    );

    await new ChangeBudgetLimitUseCase(budgets).execute({
      userId: USER,
      budgetId: BUDGET_ID,
      amount: 900,
      now: new Date(2026, 9, 15),
    });

    expect((await budgets.findById(BUDGET_ID))?.amount).toBe(900);
  });

  it('does not touch a budget that belongs to someone else', async () => {
    const budgets = new FakeBudgetRepository();
    await budgets.save(monthly('other-user'));

    await expect(
      new ChangeBudgetLimitUseCase(budgets).execute({
        userId: USER,
        budgetId: BUDGET_ID,
        amount: 700,
        now: new Date(2026, 10, 15),
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect((await budgets.findById(BUDGET_ID))?.amount).toBe(500);
  });

  it('says so when the budget does not exist', async () => {
    await expect(
      new ChangeBudgetLimitUseCase(new FakeBudgetRepository()).execute({
        userId: USER,
        budgetId: 'missing',
        amount: 700,
        now: new Date(),
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
