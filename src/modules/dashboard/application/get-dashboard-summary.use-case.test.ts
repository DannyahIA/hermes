import { describe, expect, it } from 'vitest';

import { Account } from '@/core/entities/account';
import { Category } from '@/core/entities/category';
import { Transaction } from '@/core/entities/transaction';
import { GetDashboardSummaryUseCase } from '@/modules/dashboard/application/get-dashboard-summary.use-case';
import { FakeAccountRepository } from '@/tests/fakes/fake-account.repository';
import { FakeBudgetRepository } from '@/tests/fakes/fake-budget.repository';
import { FakeCategoryRepository } from '@/tests/fakes/fake-category.repository';
import { FakeMerchantRuleRepository } from '@/tests/fakes/fake-merchant-rule.repository';
import { FakeRecurringTransactionRepository } from '@/tests/fakes/fake-recurring-transaction.repository';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';

function summarize(
  accountRepository: FakeAccountRepository,
  transactionRepository: FakeTransactionRepository,
  budgetRepository = new FakeBudgetRepository(),
  categoryRepository = new FakeCategoryRepository(),
) {
  return new GetDashboardSummaryUseCase(
    accountRepository,
    transactionRepository,
    budgetRepository,
    new FakeRecurringTransactionRepository(),
    categoryRepository,
    new FakeMerchantRuleRepository(),
  ).execute('user-1');
}

describe('GetDashboardSummaryUseCase', () => {
  it('computes netWorth from current balances, excluding future installment effects', async () => {
    const accountRepository = new FakeAccountRepository();
    const transactionRepository = new FakeTransactionRepository();
    const budgetRepository = new FakeBudgetRepository();

    await accountRepository.save(
      new Account({
        id: 'acc-1',
        userId: 'user-1',
        name: 'Conta',
        type: 'checking',
        balance: 835, // stored balance already has a future -165 installment applied
        currency: 'BRL',
        archived: false,
        hidden: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    await transactionRepository.save(
      new Transaction({
        id: 'tx-future',
        accountId: 'acc-1',
        description: 'Parcela futura',
        amount: 165,
        type: 'expense',
        occurredAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const summary = await summarize(
      accountRepository,
      transactionRepository,
      budgetRepository,
    );

    expect(summary.netWorth).toBe(1000);
    expect(summary.accountBalances).toHaveLength(1);
    expect(summary.accountBalances[0].projectedBalance).toBe(835);
    expect(summary.accountBalances[0].currentBalance).toBe(1000);
    expect(summary.futureTransactions).toHaveLength(1);
  });

  it('netWorth equals sum of stored balances when there are no future transactions', async () => {
    const accountRepository = new FakeAccountRepository();
    const transactionRepository = new FakeTransactionRepository();
    const budgetRepository = new FakeBudgetRepository();

    await accountRepository.save(
      new Account({
        id: 'acc-1',
        userId: 'user-1',
        name: 'Conta',
        type: 'checking',
        balance: 500,
        currency: 'BRL',
        archived: false,
        hidden: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const summary = await summarize(
      accountRepository,
      transactionRepository,
      budgetRepository,
    );

    expect(summary.netWorth).toBe(500);
    expect(summary.futureTransactions).toHaveLength(0);
  });

  it('counts a credit card balance, which is debt, against netWorth', async () => {
    const accountRepository = new FakeAccountRepository();
    const transactionRepository = new FakeTransactionRepository();
    const budgetRepository = new FakeBudgetRepository();

    await accountRepository.save(
      new Account({
        id: 'checking-1',
        userId: 'user-1',
        name: 'Conta',
        type: 'checking',
        balance: 1000,
        currency: 'BRL',
        archived: false,
        hidden: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    await accountRepository.save(
      new Account({
        id: 'card-1',
        userId: 'user-1',
        name: 'Cartão',
        type: 'credit',
        balance: 300, // owed
        currency: 'BRL',
        archived: false,
        hidden: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const summary = await summarize(
      accountRepository,
      transactionRepository,
      budgetRepository,
    );

    expect(summary.netWorth).toBe(700);
    expect(summary.owedOnCards).toBe(300);
  });

  it('projects net worth after future card installments, counting them as debt', async () => {
    const accountRepository = new FakeAccountRepository();
    const transactionRepository = new FakeTransactionRepository();
    const budgetRepository = new FakeBudgetRepository();

    await accountRepository.save(
      new Account({
        id: 'card-1',
        userId: 'user-1',
        name: 'Cartão',
        type: 'credit',
        balance: 500, // 300 owed today + a 200 installment dated next month
        currency: 'BRL',
        archived: false,
        hidden: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    await transactionRepository.save(
      new Transaction({
        id: 'tx-future',
        accountId: 'card-1',
        description: 'Parcela futura',
        amount: 200,
        type: 'expense',
        occurredAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const summary = await summarize(
      accountRepository,
      transactionRepository,
      budgetRepository,
    );

    expect(summary.netWorth).toBe(-300);
    expect(summary.projectedNetWorth).toBe(-500);
  });

  it('leaves a card bill payment out of the month’s spending', async () => {
    const accountRepository = new FakeAccountRepository();
    const transactionRepository = new FakeTransactionRepository();
    const budgetRepository = new FakeBudgetRepository();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await transactionRepository.save(
      new Transaction({
        id: 'purchase',
        accountId: 'card-1',
        description: 'Mercado',
        amount: 300,
        type: 'expense',
        occurredAt: today,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    await transactionRepository.save(
      new Transaction({
        id: 'payment',
        accountId: 'checking-1',
        description: 'Pagamento de fatura',
        amount: 300,
        type: 'expense',
        settlesAccountId: 'card-1',
        occurredAt: today,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const summary = await summarize(
      accountRepository,
      transactionRepository,
      budgetRepository,
    );

    expect(summary.monthToDate.spent).toBe(300);
  });

  it('excludes hidden accounts from netWorth', async () => {
    const accountRepository = new FakeAccountRepository();
    const transactionRepository = new FakeTransactionRepository();
    const budgetRepository = new FakeBudgetRepository();

    await accountRepository.save(
      new Account({
        id: 'acc-visible',
        userId: 'user-1',
        name: 'Conta visível',
        type: 'checking',
        balance: 100,
        currency: 'BRL',
        archived: false,
        hidden: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    await accountRepository.save(
      new Account({
        id: 'acc-hidden',
        userId: 'user-1',
        name: 'Conta oculta',
        type: 'checking',
        balance: 900,
        currency: 'BRL',
        archived: false,
        hidden: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const summary = await summarize(
      accountRepository,
      transactionRepository,
      budgetRepository,
    );

    expect(summary.netWorth).toBe(100);
    expect(summary.accountBalances).toHaveLength(2);
  });
  it('queues the last 30 days of uncategorized spending and income for review, with suggestions', async () => {
    const accountRepository = new FakeAccountRepository();
    const transactionRepository = new FakeTransactionRepository();
    const categoryRepository = new FakeCategoryRepository();
    const now = new Date();
    const daysAgo = (days: number) =>
      new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, 0, 1);

    for (const [id, hidden] of [
      ['card-1', false],
      ['hidden-1', true],
    ] as const) {
      await accountRepository.save(
        new Account({
          id,
          userId: 'user-1',
          name: id,
          type: 'credit',
          balance: 0,
          currency: 'BRL',
          archived: false,
          hidden,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );
    }
    await categoryRepository.save(
      new Category({
        id: 'restaurantes',
        userId: 'user-1',
        name: 'Restaurantes',
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    const save = (
      id: string,
      description: string,
      occurredAt: Date,
      overrides: Partial<ConstructorParameters<typeof Transaction>[0]> = {},
    ) =>
      transactionRepository.save(
        new Transaction({
          id,
          accountId: 'card-1',
          description,
          amount: 20,
          type: 'expense',
          occurredAt,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...overrides,
        }),
      );

    await save('filed', 'PADARIA REAL *1', daysAgo(5), {
      categoryId: 'restaurantes',
    });
    await save('padaria', 'Padaria Real', daysAgo(0));
    await save('refund', 'Estorno', daysAgo(2), { type: 'income' });
    await save('old', 'Antiga', daysAgo(31));
    await save('transfer', 'Para a reserva', daysAgo(1), { type: 'transfer' });
    await save('bill', 'Pagamento de fatura', daysAgo(1), {
      settlesAccountId: 'card-1',
    });
    await save('hidden', 'Oculta', daysAgo(1), { accountId: 'hidden-1' });

    const summary = await summarize(
      accountRepository,
      transactionRepository,
      undefined,
      categoryRepository,
    );

    expect(summary.toReview.map((t) => t.id)).toEqual(['padaria', 'refund']);
    expect(summary.categorySuggestions.padaria).toEqual(['restaurantes']);
    expect(summary.categorySuggestions.refund).toEqual([]);
    // Listed among the latest, but neither one ever takes a category.
    expect(summary.categorySuggestions.transfer).toBeUndefined();
    expect(summary.categorySuggestions.bill).toBeUndefined();
  });

  it('prepares the quick entry: accounts by how much they are used, and what each merchant was', async () => {
    const accountRepository = new FakeAccountRepository();
    const transactionRepository = new FakeTransactionRepository();
    const categoryRepository = new FakeCategoryRepository();
    const now = new Date();
    const daysAgo = (days: number) =>
      new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, 12);

    for (const [id, name, type, archived] of [
      ['checking-1', 'Nubank Conta', 'checking', false],
      ['card-1', 'Nubank Crédito', 'credit', false],
      ['old-1', 'Conta antiga', 'checking', true],
    ] as const) {
      await accountRepository.save(
        new Account({
          id,
          userId: 'user-1',
          name,
          type,
          balance: 0,
          currency: 'BRL',
          archived,
          hidden: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );
    }
    await categoryRepository.save(
      new Category({
        id: 'restaurantes',
        userId: 'user-1',
        name: 'Restaurantes',
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    const save = (
      id: string,
      description: string,
      occurredAt: Date,
      overrides: Partial<ConstructorParameters<typeof Transaction>[0]> = {},
    ) =>
      transactionRepository.save(
        new Transaction({
          id,
          accountId: 'card-1',
          description,
          amount: 20,
          type: 'expense',
          occurredAt,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...overrides,
        }),
      );

    await save('padaria', 'PADARIA REAL *1', daysAgo(5), {
      categoryId: 'restaurantes',
    });
    await save('uber', 'Uber', daysAgo(3));
    await save('salario', 'Salário', daysAgo(10), {
      type: 'income',
      accountId: 'checking-1',
    });
    await save('bill', 'Pagamento de fatura', daysAgo(1), {
      accountId: 'checking-1',
      settlesAccountId: 'card-1',
    });
    await save('long-ago', 'Cinemark', daysAgo(120));

    const summary = await summarize(
      accountRepository,
      transactionRepository,
      undefined,
      categoryRepository,
    );

    expect(summary.quickEntry.accounts).toEqual([
      {
        id: 'checking-1',
        name: 'Nubank Conta',
        type: 'checking',
        uses: { expense: 0, income: 1 },
      },
      {
        id: 'card-1',
        name: 'Nubank Crédito',
        type: 'credit',
        uses: { expense: 2, income: 0 },
      },
    ]);
    expect(summary.quickEntry.merchants).toEqual([
      {
        key: 'padaria real',
        displayName: 'Padaria Real',
        categoryId: 'restaurantes',
        type: 'expense',
        accountId: 'card-1',
      },
      {
        key: 'salario',
        displayName: 'Salário',
        type: 'income',
        accountId: 'checking-1',
      },
      {
        key: 'uber',
        displayName: 'Uber',
        type: 'expense',
        accountId: 'card-1',
      },
    ]);
  });
});
