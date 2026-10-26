import { describe, expect, it } from 'vitest';

import { Budget } from '@/core/entities/budget';
import { Transaction } from '@/core/entities/transaction';
import { FakeBudgetRepository } from '@/tests/fakes/fake-budget.repository';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';

import { GetBudgetProgressUseCase } from './get-budget-progress.use-case';

const USER_ID = 'user-1';

describe('GetBudgetProgressUseCase', () => {
  it('computes spent/remaining/percentage from expense transactions in the period', async () => {
    const budgetRepository = new FakeBudgetRepository();
    await budgetRepository.save(
      new Budget({
        id: 'budget-1',
        userId: USER_ID,
        categoryId: 'cat-1',
        amount: 200,
        currency: 'BRL',
        kind: 'fixed',
        limits: [],
        periodStart: new Date('2026-08-01T00:00:00Z'),
        periodEnd: new Date('2026-08-31T23:59:59Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const transactionRepository = new FakeTransactionRepository();
    await transactionRepository.save(
      new Transaction({
        id: 'tx-in-period',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        description: 'Mercado',
        amount: 80,
        type: 'expense',
        occurredAt: new Date('2026-08-10T00:00:00Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    await transactionRepository.save(
      new Transaction({
        id: 'tx-outside-period',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        description: 'Mercado (mês passado)',
        amount: 999,
        type: 'expense',
        occurredAt: new Date('2026-07-10T00:00:00Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    await transactionRepository.save(
      new Transaction({
        id: 'tx-income',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        description: 'Reembolso',
        amount: 500,
        type: 'income',
        occurredAt: new Date('2026-08-11T00:00:00Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const useCase = new GetBudgetProgressUseCase(
      budgetRepository,
      transactionRepository,
    );
    const [progress] = await useCase.execute(USER_ID);

    expect(progress.spent).toBe(80);
    expect(progress.remaining).toBe(120);
    expect(progress.percentage).toBe(0.4);
  });

  it('counts every purchase in the period, not just a first page of them', async () => {
    const budgetRepository = new FakeBudgetRepository();
    await budgetRepository.save(
      new Budget({
        id: 'budget-1',
        userId: USER_ID,
        categoryId: 'cafe',
        amount: 500,
        currency: 'BRL',
        kind: 'fixed',
        limits: [],
        periodStart: new Date(2026, 7, 1),
        periodEnd: new Date(2026, 7, 31, 23, 59, 59, 999),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    const transactionRepository = new FakeTransactionRepository();
    // Two coffees a day for a month.
    for (let index = 0; index < 60; index += 1) {
      await transactionRepository.save(
        new Transaction({
          id: `coffee-${index}`,
          accountId: 'acc-1',
          categoryId: 'cafe',
          description: 'Café',
          amount: 10,
          type: 'expense',
          occurredAt: new Date(
            2026,
            7,
            1 + Math.floor(index / 2),
            9 + (index % 2),
          ),
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );
    }

    const [progress] = await new GetBudgetProgressUseCase(
      budgetRepository,
      transactionRepository,
    ).execute(USER_ID);

    expect(progress.spent).toBe(600);
    expect(progress.remaining).toBe(-100);
  });
});
