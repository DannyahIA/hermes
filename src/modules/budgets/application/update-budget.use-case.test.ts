import { describe, expect, it } from 'vitest';

import { Budget } from '@/core/entities/budget';
import { FakeBudgetRepository } from '@/tests/fakes/fake-budget.repository';

import { UpdateBudgetUseCase } from './update-budget.use-case';

describe('UpdateBudgetUseCase', () => {
  it('keeps a monthly budget without an end date', async () => {
    const repository = new FakeBudgetRepository();
    await repository.save(
      new Budget({
        id: 'budget-1',
        userId: 'user-1',
        categoryId: 'mercado',
        amount: 500,
        currency: 'BRL',
        kind: 'monthly',
        limits: [],
        periodStart: new Date(2026, 8, 1),
        periodEnd: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const updated = await new UpdateBudgetUseCase(repository).execute({
      id: 'budget-1',
      userId: 'user-1',
      currency: 'USD',
    });

    expect(updated.props.periodEnd).toBeNull();
    expect(updated.kind).toBe('monthly');
  });
});
