import { describe, expect, it } from 'vitest';

import { Account } from '@/core/entities/account';
import { FakeAccountRepository } from '@/tests/fakes/fake-account.repository';
import { FakeCategoryRepository } from '@/tests/fakes/fake-category.repository';
import { FakeInstallmentPlanRepository } from '@/tests/fakes/fake-installment-plan.repository';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';

import { CreateInstallmentPlanUseCase } from './create-installment-plan.use-case';
import { DeleteInstallmentPlanUseCase } from './delete-installment-plan.use-case';

const USER_ID = 'user-1';

describe('DeleteInstallmentPlanUseCase', () => {
  it('reverses every installment balance effect and removes the plan', async () => {
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
      installmentIds: ['tx-1', 'tx-2', 'tx-3'],
    });

    expect((await accountRepository.findById('acc-1'))!.balance).toBe(700);

    await new DeleteInstallmentPlanUseCase(
      planRepository,
      transactionRepository,
      accountRepository,
    ).execute({ id: 'plan-1', userId: USER_ID });

    expect((await accountRepository.findById('acc-1'))!.balance).toBe(1000);
    expect(await planRepository.findById('plan-1')).toBeNull();
  });
});
