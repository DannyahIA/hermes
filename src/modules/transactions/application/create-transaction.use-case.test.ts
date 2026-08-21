import { describe, expect, it } from 'vitest';

import { Account } from '@/core/entities/account';
import { Category } from '@/core/entities/category';
import { DomainError } from '@/core/errors/domain-error';
import { NotFoundError } from '@/core/errors/not-found-error';
import { FakeAccountRepository } from '@/tests/fakes/fake-account.repository';
import { FakeCategoryRepository } from '@/tests/fakes/fake-category.repository';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';

import { CreateTransactionUseCase } from './create-transaction.use-case';

const USER_ID = 'user-1';

function makeAccount(
  overrides: Partial<ConstructorParameters<typeof Account>[0]> = {},
) {
  return new Account({
    id: 'acc-1',
    userId: USER_ID,
    name: 'Conta corrente',
    type: 'checking',
    balance: 100,
    currency: 'BRL',
    archived: false,
    hidden: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

describe('CreateTransactionUseCase', () => {
  it('increases the account balance for an income', async () => {
    const accountRepository = new FakeAccountRepository();
    await accountRepository.save(makeAccount());
    const useCase = new CreateTransactionUseCase(
      new FakeTransactionRepository(),
      accountRepository,
      new FakeCategoryRepository(),
    );

    await useCase.execute({
      id: 'tx-1',
      userId: USER_ID,
      accountId: 'acc-1',
      description: 'Salário',
      amount: 50,
      type: 'income',
    });

    const account = await accountRepository.findById('acc-1');
    expect(account!.balance).toBe(150);
  });

  it('decreases the account balance for an expense', async () => {
    const accountRepository = new FakeAccountRepository();
    await accountRepository.save(makeAccount());
    const useCase = new CreateTransactionUseCase(
      new FakeTransactionRepository(),
      accountRepository,
      new FakeCategoryRepository(),
    );

    await useCase.execute({
      id: 'tx-1',
      userId: USER_ID,
      accountId: 'acc-1',
      description: 'Mercado',
      amount: 30,
      type: 'expense',
    });

    const account = await accountRepository.findById('acc-1');
    expect(account!.balance).toBe(70);
  });

  it('rejects a transaction for an account owned by another user', async () => {
    const accountRepository = new FakeAccountRepository();
    await accountRepository.save(makeAccount({ userId: 'other-user' }));
    const useCase = new CreateTransactionUseCase(
      new FakeTransactionRepository(),
      accountRepository,
      new FakeCategoryRepository(),
    );

    await expect(
      useCase.execute({
        id: 'tx-1',
        userId: USER_ID,
        accountId: 'acc-1',
        description: 'x',
        amount: 10,
        type: 'income',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects a transaction against an archived category', async () => {
    const accountRepository = new FakeAccountRepository();
    await accountRepository.save(makeAccount());
    const categoryRepository = new FakeCategoryRepository();
    await categoryRepository.save(
      new Category({
        id: 'cat-1',
        userId: USER_ID,
        name: 'Lazer',
        archived: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    const useCase = new CreateTransactionUseCase(
      new FakeTransactionRepository(),
      accountRepository,
      categoryRepository,
    );

    await expect(
      useCase.execute({
        id: 'tx-1',
        userId: USER_ID,
        accountId: 'acc-1',
        categoryId: 'cat-1',
        description: 'x',
        amount: 10,
        type: 'expense',
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('rejects posting to an archived account', async () => {
    const accountRepository = new FakeAccountRepository();
    await accountRepository.save(makeAccount({ archived: true }));
    const useCase = new CreateTransactionUseCase(
      new FakeTransactionRepository(),
      accountRepository,
      new FakeCategoryRepository(),
    );

    await expect(
      useCase.execute({
        id: 'tx-1',
        userId: USER_ID,
        accountId: 'acc-1',
        description: 'x',
        amount: 10,
        type: 'income',
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});
