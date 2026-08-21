import { describe, expect, it } from 'vitest';

import { Account } from '@/core/entities/account';
import { NotFoundError } from '@/core/errors/not-found-error';
import { FakeAccountRepository } from '@/tests/fakes/fake-account.repository';
import { FakeCategoryRepository } from '@/tests/fakes/fake-category.repository';
import { FakeInstallmentPlanRepository } from '@/tests/fakes/fake-installment-plan.repository';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';

import { CreateLoanUseCase } from './create-loan.use-case';

const USER_ID = 'user-1';

function makeAccount(id: string, balance = 0) {
  return new Account({
    id,
    userId: USER_ID,
    name: `Conta ${id}`,
    type: 'checking',
    balance,
    currency: 'BRL',
    archived: false,
    hidden: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeUseCase() {
  const accountRepository = new FakeAccountRepository();
  const transactionRepository = new FakeTransactionRepository();
  const planRepository = new FakeInstallmentPlanRepository();
  const categoryRepository = new FakeCategoryRepository();

  const useCase = new CreateLoanUseCase(
    planRepository,
    transactionRepository,
    accountRepository,
    categoryRepository,
  );

  return { useCase, accountRepository, transactionRepository, planRepository };
}

describe('CreateLoanUseCase', () => {
  it('disburses the principal as income and creates a Price repayment schedule as expenses', async () => {
    const { useCase, accountRepository, transactionRepository } = makeUseCase();
    await accountRepository.save(makeAccount('checking', 500));
    await accountRepository.save(makeAccount('savings', 0));

    const { plan, disbursementTransaction } = await useCase.execute({
      id: 'loan-1',
      userId: USER_ID,
      description: 'Empréstimo pessoal',
      principal: 1000,
      monthlyInterestRate: 0.02,
      installmentCount: 6,
      disbursementAccountId: 'checking',
      repaymentAccountId: 'savings',
    });

    expect(disbursementTransaction.type).toBe('income');
    expect(disbursementTransaction.amount).toBe(1000);

    const checking = await accountRepository.findById('checking');
    expect(checking!.balance).toBe(1500); // 500 + 1000 principal received

    const installments = await transactionRepository.findByInstallmentPlanId(
      plan.id,
    );
    expect(installments).toHaveLength(6);
    expect(installments.every((i) => i.type === 'expense')).toBe(true);

    // A Price schedule with interest > 0 is NOT an even split.
    expect(installments[0].amount).not.toBeCloseTo(1000 / 6, 2);
    expect(installments[0].amount).toBeGreaterThan(1000 / 6);

    const totalRepaid = installments.reduce((sum, i) => sum + i.amount, 0);
    const savings = await accountRepository.findById('savings');
    expect(savings!.balance).toBeCloseTo(-totalRepaid, 2);
  });

  it('allows the same account for disbursement and repayment', async () => {
    const { useCase, accountRepository } = makeUseCase();
    await accountRepository.save(makeAccount('checking', 0));

    const { plan } = await useCase.execute({
      id: 'loan-2',
      userId: USER_ID,
      description: 'Empréstimo consignado',
      principal: 600,
      monthlyInterestRate: 0,
      installmentCount: 3,
      disbursementAccountId: 'checking',
      repaymentAccountId: 'checking',
    });

    expect(plan.kind).toBe('loan');
    const account = await accountRepository.findById('checking');
    // +600 disbursed, -600 repaid (0% rate) => nets back to zero.
    expect(account!.balance).toBeCloseTo(0, 2);
  });

  it('rejects an unknown disbursement account', async () => {
    const { useCase, accountRepository } = makeUseCase();
    await accountRepository.save(makeAccount('savings', 0));

    await expect(
      useCase.execute({
        id: 'loan-3',
        userId: USER_ID,
        description: 'Empréstimo',
        principal: 100,
        monthlyInterestRate: 0.01,
        installmentCount: 2,
        disbursementAccountId: 'missing',
        repaymentAccountId: 'savings',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects an unknown repayment account', async () => {
    const { useCase, accountRepository } = makeUseCase();
    await accountRepository.save(makeAccount('checking', 0));

    await expect(
      useCase.execute({
        id: 'loan-4',
        userId: USER_ID,
        description: 'Empréstimo',
        principal: 100,
        monthlyInterestRate: 0.01,
        installmentCount: 2,
        disbursementAccountId: 'checking',
        repaymentAccountId: 'missing',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
