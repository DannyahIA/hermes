import { describe, expect, it } from 'vitest';

import { Account, type AccountProps } from '@/core/entities/account';
import { Category } from '@/core/entities/category';
import { RecurringTransaction } from '@/core/entities/recurring-transaction';
import {
  Transaction,
  type TransactionProps,
} from '@/core/entities/transaction';
import { FakeAccountRepository } from '@/tests/fakes/fake-account.repository';
import { FakeBudgetRepository } from '@/tests/fakes/fake-budget.repository';
import { FakeCategoryRepository } from '@/tests/fakes/fake-category.repository';
import { FakeRecurringTransactionRepository } from '@/tests/fakes/fake-recurring-transaction.repository';
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

function makeRecurringRule(
  overrides: Partial<{
    id: string;
    type: 'income' | 'expense';
    amount: number;
    active: boolean;
  }> = {},
) {
  return new RecurringTransaction({
    id: overrides.id ?? 'rule-1',
    userId: USER_ID,
    accountId: 'acc-1',
    description: 'Regra',
    amount: overrides.amount ?? 100,
    type: overrides.type ?? 'expense',
    dayRuleKind: 'fixed_day',
    dayRuleDay: 5,
    startDate: new Date('2026-01-01T00:00:00'),
    active: overrides.active ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function buildUseCase() {
  const accountRepository = new FakeAccountRepository();
  const transactionRepository = new FakeTransactionRepository();
  const budgetRepository = new FakeBudgetRepository();
  const categoryRepository = new FakeCategoryRepository();
  const recurringTransactionRepository =
    new FakeRecurringTransactionRepository();

  const useCase = new GetSpendingReportUseCase(
    accountRepository,
    transactionRepository,
    budgetRepository,
    categoryRepository,
    recurringTransactionRepository,
  );

  return {
    useCase,
    accountRepository,
    transactionRepository,
    budgetRepository,
    categoryRepository,
    recurringTransactionRepository,
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

describe('GetSpendingReportUseCase — category comparison', () => {
  it('computes currentTotal/previousTotal/deltaPercent per category across two equal-length periods', async () => {
    const {
      useCase,
      accountRepository,
      transactionRepository,
      categoryRepository,
    } = await buildUseCase();
    await accountRepository.save(makeAccount());
    const category = new Category({
      id: 'cat-1',
      userId: USER_ID,
      name: 'Alimentação',
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await categoryRepository.save(category);

    // Previous period (June): R$100. Current period (July): R$150 → +50%.
    await transactionRepository.save(
      makeTransaction({
        id: 'tx-jun',
        categoryId: 'cat-1',
        amount: 100,
        occurredAt: new Date('2026-06-15T00:00:00'),
      }),
    );
    await transactionRepository.save(
      makeTransaction({
        id: 'tx-jul',
        categoryId: 'cat-1',
        amount: 150,
        occurredAt: new Date('2026-07-15T00:00:00'),
      }),
    );

    const report = await useCase.execute(USER_ID, {
      from: new Date('2026-07-01T00:00:00'),
      to: new Date('2026-07-31T23:59:59'),
    });

    const comparison = report.categoryComparison.find(
      (c) => c.categoryId === 'cat-1',
    );
    expect(comparison?.currentTotal).toBe(150);
    expect(comparison?.previousTotal).toBe(100);
    expect(comparison?.deltaPercent).toBe(50);
  });

  it('returns deltaPercent: null for a category with no spending in the previous period', async () => {
    const {
      useCase,
      accountRepository,
      transactionRepository,
      categoryRepository,
    } = await buildUseCase();
    await accountRepository.save(makeAccount());
    await categoryRepository.save(
      new Category({
        id: 'cat-new',
        userId: USER_ID,
        name: 'Nova categoria',
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    await transactionRepository.save(
      makeTransaction({
        id: 'tx-only',
        categoryId: 'cat-new',
        amount: 80,
        occurredAt: new Date('2026-07-10T00:00:00'),
      }),
    );

    const report = await useCase.execute(USER_ID, {
      from: new Date('2026-07-01T00:00:00'),
      to: new Date('2026-07-31T23:59:59'),
    });

    const comparison = report.categoryComparison.find(
      (c) => c.categoryId === 'cat-new',
    );
    expect(comparison?.previousTotal).toBe(0);
    expect(comparison?.deltaPercent).toBeNull();
  });

  it('sorts categoryComparison by absolute growth (currentTotal - previousTotal) descending', async () => {
    const {
      useCase,
      accountRepository,
      transactionRepository,
      categoryRepository,
    } = await buildUseCase();
    await accountRepository.save(makeAccount());
    await categoryRepository.save(
      new Category({
        id: 'cat-small',
        userId: USER_ID,
        name: 'Pequena',
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    await categoryRepository.save(
      new Category({
        id: 'cat-big',
        userId: USER_ID,
        name: 'Grande',
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    // cat-small: 2 -> 20 (900% but +18 absolute). cat-big: 500 -> 800 (+300 absolute, 60%).
    await transactionRepository.save(
      makeTransaction({
        id: 't1',
        categoryId: 'cat-small',
        amount: 2,
        occurredAt: new Date('2026-06-05T00:00:00'),
      }),
    );
    await transactionRepository.save(
      makeTransaction({
        id: 't2',
        categoryId: 'cat-small',
        amount: 20,
        occurredAt: new Date('2026-07-05T00:00:00'),
      }),
    );
    await transactionRepository.save(
      makeTransaction({
        id: 't3',
        categoryId: 'cat-big',
        amount: 500,
        occurredAt: new Date('2026-06-05T00:00:00'),
      }),
    );
    await transactionRepository.save(
      makeTransaction({
        id: 't4',
        categoryId: 'cat-big',
        amount: 800,
        occurredAt: new Date('2026-07-05T00:00:00'),
      }),
    );

    const report = await useCase.execute(USER_ID, {
      from: new Date('2026-07-01T00:00:00'),
      to: new Date('2026-07-31T23:59:59'),
    });

    expect(report.categoryComparison[0].categoryId).toBe('cat-big');
  });
});

describe('GetSpendingReportUseCase — recurring expense share', () => {
  it('sums active recurring expense rules and divides by average monthly income', async () => {
    const {
      useCase,
      accountRepository,
      transactionRepository,
      recurringTransactionRepository,
    } = await buildUseCase();
    await accountRepository.save(makeAccount());
    await recurringTransactionRepository.save(
      makeRecurringRule({
        id: 'r1',
        type: 'expense',
        amount: 300,
        active: true,
      }),
    );
    await recurringTransactionRepository.save(
      makeRecurringRule({
        id: 'r2',
        type: 'expense',
        amount: 200,
        active: true,
      }),
    );
    await recurringTransactionRepository.save(
      makeRecurringRule({
        id: 'r3',
        type: 'expense',
        amount: 999,
        active: false,
      }),
    ); // inactive, excluded
    await recurringTransactionRepository.save(
      makeRecurringRule({
        id: 'r4',
        type: 'income',
        amount: 500,
        active: true,
      }),
    ); // income, excluded
    await transactionRepository.save(
      makeTransaction({
        id: 'tx-income',
        type: 'income',
        amount: 2000,
        occurredAt: new Date('2026-07-10T00:00:00'),
      }),
    );

    // 1-month period: averageMonthlyIncome = totalIncome / 1 = 2000.
    const report = await useCase.execute(USER_ID, {
      from: new Date('2026-07-01T00:00:00'),
      to: new Date('2026-07-31T23:59:59'),
    });

    expect(report.recurringExpenseShare.monthlyRecurringExpense).toBe(500);
    expect(report.recurringExpenseShare.averageMonthlyIncome).toBe(2000);
    expect(report.recurringExpenseShare.percentage).toBe(25);
  });

  it('returns percentage: null when there is no income in the period', async () => {
    const { useCase, accountRepository, recurringTransactionRepository } =
      await buildUseCase();
    await accountRepository.save(makeAccount());
    await recurringTransactionRepository.save(
      makeRecurringRule({ amount: 100, active: true }),
    );

    const report = await useCase.execute(USER_ID, {
      from: new Date('2026-07-01T00:00:00'),
      to: new Date('2026-07-31T23:59:59'),
    });

    expect(report.recurringExpenseShare.percentage).toBeNull();
  });
});
