import { describe, expect, it } from 'vitest';

import { Account, type AccountProps } from '@/core/entities/account';
import { Transaction } from '@/core/entities/transaction';
import { GetMoneyOverviewUseCase } from '@/modules/accounts/application/get-money-overview.use-case';
import { FakeAccountRepository } from '@/tests/fakes/fake-account.repository';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';

const NOW = new Date(2026, 9, 15, 12);

function account(overrides: Partial<AccountProps> & { id: string }): Account {
  return new Account({
    userId: 'user-1',
    name: overrides.id,
    type: 'checking',
    balance: 0,
    currency: 'BRL',
    archived: false,
    hidden: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

function expense(
  id: string,
  occurredAt: Date,
  extra: { installmentPlanId?: string; amount?: number } = {},
): Transaction {
  return new Transaction({
    id,
    // Not one of the listed accounts: keeps these rows out of the balances.
    accountId: 'elsewhere',
    description: id,
    amount: extra.amount ?? 100,
    type: 'expense',
    occurredAt,
    createdAt: NOW,
    updatedAt: NOW,
    installmentPlanId: extra.installmentPlanId,
  });
}

async function setup(accounts: Account[], transactions: Transaction[] = []) {
  const accountRepository = new FakeAccountRepository();
  const transactionRepository = new FakeTransactionRepository();
  for (const a of accounts) await accountRepository.save(a);
  for (const t of transactions) await transactionRepository.save(t);
  return new GetMoneyOverviewUseCase(accountRepository, transactionRepository);
}

describe('GetMoneyOverviewUseCase', () => {
  it('sums checking, cards owed, savings and this month’s installments', async () => {
    const useCase = await setup(
      [
        account({ id: 'chk', balance: 1000 }),
        account({ id: 'chk2', balance: 250 }),
        account({ id: 'card', type: 'credit', balance: 400, closingDay: 5 }),
        account({ id: 'card2', type: 'credit', balance: 100 }),
        account({ id: 'sav', type: 'savings', balance: 3000 }),
      ],
      [
        expense('this-month', new Date(2026, 9, 20), {
          installmentPlanId: 'plan-1',
          amount: 150,
        }),
        expense('first-day', new Date(2026, 9, 1), {
          installmentPlanId: 'plan-2',
          amount: 50,
        }),
        expense('last-month', new Date(2026, 8, 20), {
          installmentPlanId: 'plan-1',
          amount: 999,
        }),
        expense('next-month', new Date(2026, 10, 1), {
          installmentPlanId: 'plan-1',
          amount: 999,
        }),
        expense('no-plan', new Date(2026, 9, 10), { amount: 777 }),
      ],
    );

    const overview = await useCase.execute('user-1', NOW);

    expect(overview.checking).toBe(1250);
    expect(overview.cards).toBe(500);
    expect(overview.savings).toBe(3000);
    expect(overview.installmentsThisMonth).toBe(200);
    expect(overview.groups.map((g) => g.kind)).toEqual([
      'checking',
      'credit',
      'savings',
    ]);
  });

  it('tucks archived and hidden accounts away at the end', async () => {
    const useCase = await setup([
      account({ id: 'chk', balance: 1000 }),
      account({ id: 'old', balance: 500, archived: true }),
      account({ id: 'secret', type: 'savings', balance: 900, hidden: true }),
    ]);

    const overview = await useCase.execute('user-1', NOW);

    expect(overview.groups.flatMap((g) => g.accounts.map((a) => a.id))).toEqual(
      ['chk'],
    );
    expect(overview.tucked.map((a) => a.id).sort()).toEqual(['old', 'secret']);
    expect(overview.checking).toBe(1000);
    expect(overview.savings).toBe(0);
  });

  it('describes a card with its closing day, due day and next due date', async () => {
    const useCase = await setup([
      account({
        id: 'card',
        type: 'credit',
        balance: 400,
        closingDay: 5,
        dueDay: 20,
      }),
    ]);

    const overview = await useCase.execute('user-1', NOW);

    expect(overview.groups).toHaveLength(1);
    expect(overview.groups[0].accounts[0]).toMatchObject({
      id: 'card',
      balance: 400,
      closingDay: 5,
      dueDay: 20,
      nextDue: new Date(2026, 9, 20),
    });
  });
});
