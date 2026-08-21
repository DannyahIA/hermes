import { describe, expect, it } from 'vitest';

import { Account } from '@/core/entities/account';
import { FakeAccountRepository } from '@/tests/fakes/fake-account.repository';
import { FakeCategoryRepository } from '@/tests/fakes/fake-category.repository';
import { FakeInstallmentPlanRepository } from '@/tests/fakes/fake-installment-plan.repository';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';

import { CreateInstallmentPlanUseCase } from './create-installment-plan.use-case';
import { UpdateInstallmentUseCase } from './update-installment.use-case';

const USER_ID = 'user-1';

async function setupPlan() {
  const accountRepository = new FakeAccountRepository();
  await accountRepository.save(
    new Account({
      id: 'acc-1',
      userId: USER_ID,
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
  const transactionRepository = new FakeTransactionRepository();
  const planRepository = new FakeInstallmentPlanRepository();

  await new CreateInstallmentPlanUseCase(
    planRepository,
    transactionRepository,
    accountRepository,
    new FakeCategoryRepository(),
  ).execute({
    id: 'plan-1',
    userId: USER_ID,
    accountId: 'acc-1',
    description: 'Notebook',
    kind: 'purchase',
    totalAmount: 300,
    installmentCount: 3,
    startDate: new Date('2026-08-01'),
    installmentIds: ['tx-1', 'tx-2', 'tx-3'],
  });

  return { accountRepository, transactionRepository, planRepository };
}

describe('UpdateInstallmentUseCase', () => {
  it('edits only the targeted installment when propagateToFuture is false', async () => {
    const { accountRepository, transactionRepository, planRepository } =
      await setupPlan();
    const useCase = new UpdateInstallmentUseCase(
      transactionRepository,
      accountRepository,
      planRepository,
    );

    await useCase.execute({
      id: 'tx-1',
      userId: USER_ID,
      amount: 150,
      propagateToFuture: false,
    });

    const installments =
      await transactionRepository.findByInstallmentPlanId('plan-1');
    expect(installments.map((i) => i.amount)).toEqual([150, 100, 100]);

    const account = await accountRepository.findById('acc-1');
    expect(account!.balance).toBe(1000 - 150 - 100 - 100);
  });

  it('propagates an amount change to every later installment', async () => {
    const { accountRepository, transactionRepository, planRepository } =
      await setupPlan();
    const useCase = new UpdateInstallmentUseCase(
      transactionRepository,
      accountRepository,
      planRepository,
    );

    await useCase.execute({
      id: 'tx-1',
      userId: USER_ID,
      amount: 120,
      propagateToFuture: true,
    });

    const installments =
      await transactionRepository.findByInstallmentPlanId('plan-1');
    expect(installments.map((i) => i.amount)).toEqual([120, 120, 120]);

    const account = await accountRepository.findById('acc-1');
    expect(account!.balance).toBe(1000 - 120 * 3);
  });

  it('does not touch installments before the edited one', async () => {
    const { accountRepository, transactionRepository, planRepository } =
      await setupPlan();
    const useCase = new UpdateInstallmentUseCase(
      transactionRepository,
      accountRepository,
      planRepository,
    );

    await useCase.execute({
      id: 'tx-2',
      userId: USER_ID,
      amount: 200,
      propagateToFuture: true,
    });

    const installments =
      await transactionRepository.findByInstallmentPlanId('plan-1');
    expect(installments.map((i) => i.amount)).toEqual([100, 200, 200]);
  });
});
