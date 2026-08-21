import { describe, expect, it } from 'vitest';

import { Account } from '@/core/entities/account';
import { Transaction } from '@/core/entities/transaction';
import { GetDashboardSummaryUseCase } from '@/modules/dashboard/application/get-dashboard-summary.use-case';
import { FakeAccountRepository } from '@/tests/fakes/fake-account.repository';
import { FakeBudgetRepository } from '@/tests/fakes/fake-budget.repository';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';

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

    const summary = await new GetDashboardSummaryUseCase(
      accountRepository,
      transactionRepository,
      budgetRepository,
    ).execute('user-1');

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

    const summary = await new GetDashboardSummaryUseCase(
      accountRepository,
      transactionRepository,
      budgetRepository,
    ).execute('user-1');

    expect(summary.netWorth).toBe(500);
    expect(summary.futureTransactions).toHaveLength(0);
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

    const summary = await new GetDashboardSummaryUseCase(
      accountRepository,
      transactionRepository,
      budgetRepository,
    ).execute('user-1');

    expect(summary.netWorth).toBe(100);
    expect(summary.accountBalances).toHaveLength(2);
  });
});
