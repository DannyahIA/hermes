import { describe, expect, it } from 'vitest';

import { Account } from '@/core/entities/account';
import { FakeAccountRepository } from '@/tests/fakes/fake-account.repository';
import { FakeCategoryRepository } from '@/tests/fakes/fake-category.repository';
import { FakeInstallmentPlanRepository } from '@/tests/fakes/fake-installment-plan.repository';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';

import { CreateInstallmentPlanUseCase } from './create-installment-plan.use-case';

const USER_ID = 'user-1';

function makeAccount(balance = 0) {
  return new Account({
    id: 'acc-1',
    userId: USER_ID,
    name: 'Cartão',
    type: 'checking',
    balance,
    currency: 'BRL',
    archived: false,
    hidden: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('CreateInstallmentPlanUseCase', () => {
  it('splits a purchase into N dated installments and debits the account for all of them', async () => {
    const accountRepository = new FakeAccountRepository();
    await accountRepository.save(makeAccount(1000));
    const transactionRepository = new FakeTransactionRepository();
    const planRepository = new FakeInstallmentPlanRepository();

    const useCase = new CreateInstallmentPlanUseCase(
      planRepository,
      transactionRepository,
      accountRepository,
      new FakeCategoryRepository(),
    );

    const plan = await useCase.execute({
      id: 'plan-1',
      userId: USER_ID,
      accountId: 'acc-1',
      description: 'Notebook',
      kind: 'purchase',
      totalAmount: 300,
      installmentCount: 3,
      startDate: new Date(2026, 7, 1), // August 1st, local time — avoids UTC/local ISO-string skew
      installmentIds: ['tx-1', 'tx-2', 'tx-3'],
    });

    expect(plan.installmentCount).toBe(3);

    const installments =
      await transactionRepository.findByInstallmentPlanId('plan-1');
    expect(installments).toHaveLength(3);
    expect(installments.map((i) => i.amount)).toEqual([100, 100, 100]);
    expect(installments[1].occurredAt.getMonth()).toBe(8); // September (0-indexed)
    expect(installments.every((i) => i.installmentPlanId === 'plan-1')).toBe(
      true,
    );

    const account = await accountRepository.findById('acc-1');
    expect(account!.balance).toBe(700); // 1000 - 300
  });

  it('generates a Price amortization schedule for a loan', async () => {
    const accountRepository = new FakeAccountRepository();
    await accountRepository.save(makeAccount(0));
    const transactionRepository = new FakeTransactionRepository();
    const planRepository = new FakeInstallmentPlanRepository();

    const useCase = new CreateInstallmentPlanUseCase(
      planRepository,
      transactionRepository,
      accountRepository,
      new FakeCategoryRepository(),
    );

    await useCase.execute({
      id: 'loan-1',
      userId: USER_ID,
      accountId: 'acc-1',
      description: 'Empréstimo pessoal',
      kind: 'loan',
      totalAmount: 1000,
      installmentCount: 6,
      interestRate: 0.02,
      installmentIds: ['tx-1', 'tx-2', 'tx-3', 'tx-4', 'tx-5', 'tx-6'],
    });

    const installments =
      await transactionRepository.findByInstallmentPlanId('loan-1');
    // The Price schedule's fixed amount is above 1000/6 because of interest.
    expect(installments[0].amount).toBeGreaterThan(1000 / 6);

    const account = await accountRepository.findById('acc-1');
    const totalDebited = installments.reduce((sum, i) => sum + i.amount, 0);
    expect(account!.balance).toBeCloseTo(-totalDebited, 2);
  });

  it('computes totalAmount from installmentAmount when only the per-installment value is given', async () => {
    const installmentPlanRepository = new FakeInstallmentPlanRepository();
    const transactionRepository = new FakeTransactionRepository();
    const accountRepository = new FakeAccountRepository();
    const categoryRepository = new FakeCategoryRepository();

    await accountRepository.save(
      new Account({
        id: 'acc-1',
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

    const useCase = new CreateInstallmentPlanUseCase(
      installmentPlanRepository,
      transactionRepository,
      accountRepository,
      categoryRepository,
    );

    const plan = await useCase.execute({
      id: 'plan-1',
      userId: 'user-1',
      accountId: 'acc-1',
      description: 'Compra parcelada',
      kind: 'purchase',
      installmentAmount: 150,
      installmentCount: 10,
      installmentIds: Array.from({ length: 10 }, (_, i) => `tx-${i}`),
    });

    expect(plan.totalAmount).toBe(1500);
    const installments =
      await transactionRepository.findByInstallmentPlanId('plan-1');
    expect(installments.every((t) => t.amount === 150)).toBe(true);
  });

  it('still uses totalAmount directly when installmentAmount is not given (existing behavior unchanged)', async () => {
    const installmentPlanRepository = new FakeInstallmentPlanRepository();
    const transactionRepository = new FakeTransactionRepository();
    const accountRepository = new FakeAccountRepository();
    const categoryRepository = new FakeCategoryRepository();

    await accountRepository.save(
      new Account({
        id: 'acc-1',
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

    const useCase = new CreateInstallmentPlanUseCase(
      installmentPlanRepository,
      transactionRepository,
      accountRepository,
      categoryRepository,
    );

    const plan = await useCase.execute({
      id: 'plan-2',
      userId: 'user-1',
      accountId: 'acc-1',
      description: 'Compra parcelada',
      kind: 'purchase',
      totalAmount: 1000,
      installmentCount: 3,
      installmentIds: ['tx-a', 'tx-b', 'tx-c'],
    });

    expect(plan.totalAmount).toBe(1000);
  });

  it('produces installments exactly equal to the typed installmentAmount, not a re-split of the total (regression for C3)', async () => {
    const installmentPlanRepository = new FakeInstallmentPlanRepository();
    const transactionRepository = new FakeTransactionRepository();
    const accountRepository = new FakeAccountRepository();
    const categoryRepository = new FakeCategoryRepository();

    await accountRepository.save(
      new Account({
        id: 'acc-1',
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

    const useCase = new CreateInstallmentPlanUseCase(
      installmentPlanRepository,
      transactionRepository,
      accountRepository,
      categoryRepository,
    );

    await useCase.execute({
      id: 'plan-3',
      userId: 'user-1',
      accountId: 'acc-1',
      description: 'Compra parcelada',
      kind: 'purchase',
      installmentAmount: 10.03,
      installmentCount: 4,
      installmentIds: ['tx-x', 'tx-y', 'tx-z', 'tx-w'],
    });

    const installments =
      await transactionRepository.findByInstallmentPlanId('plan-3');
    expect(installments.map((i) => i.amount)).toEqual([
      10.03, 10.03, 10.03, 10.03,
    ]);
  });
});
