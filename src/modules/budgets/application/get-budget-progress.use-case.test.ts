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
  describe('a budget asked about on a given day', () => {
    function expense(id: string, amount: number, occurredAt: Date) {
      return new Transaction({
        id,
        accountId: 'acc-1',
        categoryId: 'mercado',
        description: 'Mercado',
        amount,
        type: 'expense',
        occurredAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    function budget(
      overrides: Partial<ConstructorParameters<typeof Budget>[0]>,
    ) {
      return new Budget({
        id: 'budget-1',
        userId: USER_ID,
        categoryId: 'mercado',
        amount: 500,
        currency: 'BRL',
        kind: 'monthly',
        limits: [],
        periodStart: new Date(2026, 8, 1),
        periodEnd: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
      });
    }

    async function setup(budgets: Budget[]) {
      const budgetRepository = new FakeBudgetRepository();
      for (const b of budgets) await budgetRepository.save(b);
      const transactionRepository = new FakeTransactionRepository();
      await transactionRepository.save(
        expense('sep', 200, new Date(2026, 8, 30, 12)),
      );
      await transactionRepository.save(
        expense('oct-1', 120, new Date(2026, 9, 2, 12)),
      );
      await transactionRepository.save(
        expense('oct-2', 80, new Date(2026, 9, 20, 12)),
      );
      return new GetBudgetProgressUseCase(
        budgetRepository,
        transactionRepository,
      );
    }

    it('counts a monthly budget from the 1st of the month asked for', async () => {
      const useCase = await setup([budget({})]);

      const [october] = await useCase.execute(USER_ID, new Date(2026, 9, 26));
      expect(october.spent).toBe(200);
      expect(october.period.start).toEqual(new Date(2026, 9, 1));
      expect(october.running).toBe(true);

      const [september] = await useCase.execute(USER_ID, new Date(2026, 8, 15));
      expect(september.spent).toBe(200);
      expect(september.period.start).toEqual(new Date(2026, 8, 1));
    });

    it('uses the limit in force on the day asked for', async () => {
      const useCase = await setup([
        budget({
          amount: 800,
          limits: [
            { startsOn: new Date(2026, 8, 1), amount: 500 },
            { startsOn: new Date(2026, 9, 1), amount: 800 },
          ],
        }),
      ]);

      const [september] = await useCase.execute(USER_ID, new Date(2026, 8, 15));
      const [october] = await useCase.execute(USER_ID, new Date(2026, 9, 26));

      expect(september.amount).toBe(500);
      expect(october.amount).toBe(800);
      expect(october.remaining).toBe(600);
      expect(october.percentage).toBe(0.25);
    });

    it('lists a fixed budget that ended, not running, over its own dates', async () => {
      const useCase = await setup([
        budget({
          kind: 'fixed',
          periodStart: new Date(2026, 8, 1),
          periodEnd: new Date(2026, 8, 30, 23, 59, 59, 999),
        }),
      ]);

      const [ended] = await useCase.execute(USER_ID, new Date(2026, 9, 26));

      expect(ended.running).toBe(false);
      expect(ended.spent).toBe(200);
      expect(ended.period.end).toEqual(new Date(2026, 8, 30, 23, 59, 59, 999));
    });

    it('defaults to today', async () => {
      const useCase = await setup([
        budget({ periodStart: new Date(2020, 0, 1) }),
      ]);
      const [progress] = await useCase.execute(USER_ID);
      expect(progress.running).toBe(true);
      expect(progress.period.contains(new Date())).toBe(true);
    });
  });
});
