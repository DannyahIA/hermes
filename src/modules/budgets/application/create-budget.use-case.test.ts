import { describe, expect, it } from 'vitest';

import { Category } from '@/core/entities/category';
import { NotFoundError } from '@/core/errors/not-found-error';
import { FakeBudgetRepository } from '@/tests/fakes/fake-budget.repository';
import { FakeCategoryRepository } from '@/tests/fakes/fake-category.repository';

import { CreateBudgetUseCase } from './create-budget.use-case';

const USER = 'user-1';

describe('CreateBudgetUseCase', () => {
  it('starts a monthly budget on the first day of this month, with no end', async () => {
    const { useCase, budgets } = await setup();

    const created = await useCase.execute({
      id: 'b-1',
      userId: USER,
      categoryId: 'cat-1',
      amount: 500,
      currency: 'BRL',
      kind: 'monthly',
      periodStart: new Date(2020, 0, 1),
      periodEnd: new Date(2020, 0, 31),
      now: new Date(2026, 10, 15),
    });

    expect(created.kind).toBe('monthly');
    expect(created.periodStart).toEqual(new Date(2026, 10, 1));
    expect(created.props.periodEnd).toBeNull();
    expect(await budgets.findById('b-1')).toBe(created);
  });

  it('keeps the dates of a budget with dates', async () => {
    const { useCase } = await setup();

    const created = await useCase.execute({
      id: 'b-1',
      userId: USER,
      categoryId: 'cat-1',
      amount: 500,
      currency: 'BRL',
      kind: 'fixed',
      periodStart: new Date(2026, 9, 1),
      periodEnd: new Date(2026, 9, 31, 23, 59, 59, 999),
    });

    expect(created.kind).toBe('fixed');
    expect(created.props.periodEnd).toEqual(
      new Date(2026, 9, 31, 23, 59, 59, 999),
    );
  });

  it('refuses a budget with dates that has no dates', async () => {
    const { useCase } = await setup();

    await expect(
      useCase.execute({
        id: 'b-1',
        userId: USER,
        categoryId: 'cat-1',
        amount: 500,
        currency: 'BRL',
        kind: 'fixed',
      }),
    ).rejects.toThrow();
  });

  it('refuses a category that belongs to someone else', async () => {
    const { useCase } = await setup('other-user');

    await expect(
      useCase.execute({
        id: 'b-1',
        userId: USER,
        categoryId: 'cat-1',
        amount: 500,
        currency: 'BRL',
        kind: 'monthly',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

async function setup(categoryOwner = USER) {
  const budgets = new FakeBudgetRepository();
  const categories = new FakeCategoryRepository();
  await categories.save(
    new Category({
      id: 'cat-1',
      userId: categoryOwner,
      name: 'Mercado',
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  );
  return { budgets, useCase: new CreateBudgetUseCase(budgets, categories) };
}
