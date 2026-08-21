import { describe, expect, it } from 'vitest';

import { Account, type AccountProps } from '@/core/entities/account';
import { Category } from '@/core/entities/category';
import {
  Transaction,
  type TransactionProps,
} from '@/core/entities/transaction';
import { FakeAccountRepository } from '@/tests/fakes/fake-account.repository';
import { FakeBudgetRepository } from '@/tests/fakes/fake-budget.repository';
import { FakeCategoryRepository } from '@/tests/fakes/fake-category.repository';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';

import { GetSpendingReportUseCase } from './get-spending-report.use-case';

const USER_ID = 'user-1';

function makeAccount(overrides: Partial<AccountProps> = {}) {
  return new Account({
    id: 'acc-1',
    userId: USER_ID,
    name: 'Carteira',
    type: 'checking',
    balance: 1000,
    currency: 'BRL',
    archived: false,
    hidden: false,
    createdAt: new Date('2026-01-01T00:00:00'),
    updatedAt: new Date('2026-01-01T00:00:00'),
    ...overrides,
  });
}

function makeTransaction(overrides: Partial<TransactionProps> = {}) {
  return new Transaction({
    id: 'tx',
    accountId: 'acc-1',
    description: 'Movimentação',
    amount: 100,
    type: 'expense',
    occurredAt: new Date('2026-08-10T00:00:00'),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

async function buildUseCase() {
  const accountRepository = new FakeAccountRepository();
  const transactionRepository = new FakeTransactionRepository();
  const budgetRepository = new FakeBudgetRepository();
  const categoryRepository = new FakeCategoryRepository();

  const useCase = new GetSpendingReportUseCase(
    accountRepository,
    transactionRepository,
    budgetRepository,
    categoryRepository,
  );

  return {
    useCase,
    accountRepository,
    transactionRepository,
    budgetRepository,
    categoryRepository,
  };
}

describe('GetSpendingReportUseCase', () => {
  it('sums income/expense and buckets cash flow by month', async () => {
    const { useCase, accountRepository, transactionRepository } =
      await buildUseCase();

    await accountRepository.save(makeAccount({ balance: 500 }));
    await transactionRepository.save(
      makeTransaction({
        id: 'tx-income-jul',
        type: 'income',
        amount: 300,
        occurredAt: new Date('2026-07-05T00:00:00'),
      }),
    );
    await transactionRepository.save(
      makeTransaction({
        id: 'tx-expense-jul',
        type: 'expense',
        amount: 120,
        occurredAt: new Date('2026-07-15T00:00:00'),
      }),
    );
    await transactionRepository.save(
      makeTransaction({
        id: 'tx-expense-aug',
        type: 'expense',
        amount: 80,
        occurredAt: new Date('2026-08-01T00:00:00'),
      }),
    );

    const report = await useCase.execute(USER_ID, {
      from: new Date('2026-07-01T00:00:00'),
      to: new Date('2026-08-31T23:59:59'),
    });

    expect(report.totalIncome).toBe(300);
    expect(report.totalExpense).toBe(200);
    expect(report.cashFlowByMonth).toHaveLength(2);
    expect(report.cashFlowByMonth[0]).toMatchObject({
      income: 300,
      expense: 120,
    });
    expect(report.cashFlowByMonth[1]).toMatchObject({
      income: 0,
      expense: 80,
    });
  });

  it('ranks spending by category, grouping uncategorized expenses', async () => {
    const {
      useCase,
      accountRepository,
      transactionRepository,
      categoryRepository,
    } = await buildUseCase();

    await accountRepository.save(makeAccount());
    await categoryRepository.save(
      new Category({
        id: 'cat-food',
        userId: USER_ID,
        name: 'Alimentação',
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    await categoryRepository.save(
      new Category({
        id: 'cat-transport',
        userId: USER_ID,
        name: 'Transporte',
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    await transactionRepository.save(
      makeTransaction({
        id: 'tx-food',
        type: 'expense',
        amount: 150,
        categoryId: 'cat-food',
        occurredAt: new Date('2026-08-05T00:00:00'),
      }),
    );
    await transactionRepository.save(
      makeTransaction({
        id: 'tx-transport',
        type: 'expense',
        amount: 40,
        categoryId: 'cat-transport',
        occurredAt: new Date('2026-08-06T00:00:00'),
      }),
    );
    await transactionRepository.save(
      makeTransaction({
        id: 'tx-no-category',
        type: 'expense',
        amount: 200,
        occurredAt: new Date('2026-08-07T00:00:00'),
      }),
    );
    // Income should never appear in the category breakdown.
    await transactionRepository.save(
      makeTransaction({
        id: 'tx-income',
        type: 'income',
        amount: 999,
        categoryId: 'cat-food',
        occurredAt: new Date('2026-08-08T00:00:00'),
      }),
    );

    const report = await useCase.execute(USER_ID, {
      from: new Date('2026-08-01T00:00:00'),
      to: new Date('2026-08-31T23:59:59'),
    });

    expect(report.spendingByCategory).toEqual([
      {
        categoryId: 'uncategorized',
        categoryName: 'Sem categoria',
        total: 200,
      },
      { categoryId: 'cat-food', categoryName: 'Alimentação', total: 150 },
      { categoryId: 'cat-transport', categoryName: 'Transporte', total: 40 },
    ]);
  });

  it('walks net worth backward from the current balance, ignoring transfers', async () => {
    const { useCase, accountRepository, transactionRepository } =
      await buildUseCase();

    // Current balance is 1000. In August the account earned 300 and spent
    // 100 (net +200), so July's ending net worth must be 1000 - 200 = 800.
    await accountRepository.save(makeAccount({ balance: 1000 }));
    await transactionRepository.save(
      makeTransaction({
        id: 'tx-aug-income',
        type: 'income',
        amount: 300,
        occurredAt: new Date('2026-08-10T00:00:00'),
      }),
    );
    await transactionRepository.save(
      makeTransaction({
        id: 'tx-aug-expense',
        type: 'expense',
        amount: 100,
        occurredAt: new Date('2026-08-15T00:00:00'),
      }),
    );
    // A transfer must not move net worth at all.
    await transactionRepository.save(
      makeTransaction({
        id: 'tx-aug-transfer',
        type: 'transfer',
        amount: 500,
        occurredAt: new Date('2026-08-20T00:00:00'),
      }),
    );

    const report = await useCase.execute(USER_ID, {
      from: new Date('2026-07-01T00:00:00'),
      to: new Date('2026-08-20T00:00:00'),
    });

    expect(report.netWorthByMonth).toHaveLength(2);
    expect(report.netWorthByMonth[0]).toMatchObject({ netWorth: 800 });
    expect(report.netWorthByMonth[1]).toMatchObject({ netWorth: 1000 });
  });

  it('accounts for a credit card by inverting the income/expense delta', async () => {
    const { useCase, accountRepository, transactionRepository } =
      await buildUseCase();

    // A credit card's balance represents debt: an expense increases it, so
    // walking backward an expense *decreases* what the earlier balance was.
    await accountRepository.save(
      makeAccount({ id: 'card-1', type: 'credit', balance: 300 }),
    );
    await transactionRepository.save(
      makeTransaction({
        id: 'tx-card-expense',
        accountId: 'card-1',
        type: 'expense',
        amount: 300,
        occurredAt: new Date('2026-08-05T00:00:00'),
      }),
    );

    const report = await useCase.execute(USER_ID, {
      from: new Date('2026-07-01T00:00:00'),
      to: new Date('2026-08-31T23:59:59'),
    });

    expect(report.netWorthByMonth).toHaveLength(2);
    // July, before the purchase, had no debt on the card.
    expect(report.netWorthByMonth[0]).toMatchObject({ netWorth: 0 });
    // August carries the current (debt) balance.
    expect(report.netWorthByMonth[1]).toMatchObject({ netWorth: 300 });
  });

  it('excludes hidden accounts from net worth', async () => {
    const { useCase, accountRepository } = await buildUseCase();

    await accountRepository.save(makeAccount({ id: 'visible', balance: 100 }));
    await accountRepository.save(
      makeAccount({ id: 'hidden', balance: 5000, hidden: true }),
    );

    const report = await useCase.execute(USER_ID, {
      from: new Date('2026-08-01T00:00:00'),
      to: new Date('2026-08-31T23:59:59'),
    });

    expect(report.netWorthByMonth[0]?.netWorth).toBe(100);
  });
});
