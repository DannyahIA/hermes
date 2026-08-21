import { describe, expect, it } from 'vitest';

import { Budget } from '@/core/entities/budget';
import { NotFoundError } from '@/core/errors/not-found-error';
import { FakeBudgetRepository } from '@/tests/fakes/fake-budget.repository';

import { DeleteBudgetUseCase } from './delete-budget.use-case';

const USER_ID = 'user-1';

describe('DeleteBudgetUseCase', () => {
  it('actually deletes the budget (regression: used to call save() instead)', async () => {
    const repository = new FakeBudgetRepository();
    await repository.save(
      new Budget({
        id: 'budget-1',
        userId: USER_ID,
        categoryId: 'cat-1',
        amount: 500,
        currency: 'BRL',
        periodStart: new Date('2026-08-01'),
        periodEnd: new Date('2026-08-31'),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    const useCase = new DeleteBudgetUseCase(repository);

    await useCase.execute({ id: 'budget-1', userId: USER_ID });

    expect(await repository.findById('budget-1')).toBeNull();
  });

  it('rejects deleting a budget owned by another user', async () => {
    const repository = new FakeBudgetRepository();
    await repository.save(
      new Budget({
        id: 'budget-1',
        userId: 'other-user',
        categoryId: 'cat-1',
        amount: 500,
        currency: 'BRL',
        periodStart: new Date('2026-08-01'),
        periodEnd: new Date('2026-08-31'),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    const useCase = new DeleteBudgetUseCase(repository);

    await expect(
      useCase.execute({ id: 'budget-1', userId: USER_ID }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
