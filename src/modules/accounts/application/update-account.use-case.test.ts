import { describe, expect, it } from 'vitest';

import { Account } from '@/core/entities/account';
import { NotFoundError } from '@/core/errors/not-found-error';
import { FakeAccountRepository } from '@/tests/fakes/fake-account.repository';

import { UpdateAccountUseCase } from './update-account.use-case';

function seedAccount(repository: FakeAccountRepository) {
  const account = new Account({
    id: 'acc-1',
    userId: 'user-1',
    name: 'Conta corrente',
    type: 'checking',
    balance: 500,
    currency: 'BRL',
    archived: false,
    hidden: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  repository.save(account);
  return account;
}

describe('UpdateAccountUseCase', () => {
  it('updates editable fields without touching balance', async () => {
    const repository = new FakeAccountRepository();
    seedAccount(repository);
    const useCase = new UpdateAccountUseCase(repository);

    const updated = await useCase.execute({ id: 'acc-1', name: 'Nova conta' });

    expect(updated.name).toBe('Nova conta');
    // Balance isn't even an accepted input field — this asserts it survives
    // an update untouched, guarding the Single Source of Truth invariant.
    expect(updated.balance).toBe(500);
  });

  it('throws NotFoundError for an unknown account', async () => {
    const useCase = new UpdateAccountUseCase(new FakeAccountRepository());

    await expect(
      useCase.execute({ id: 'missing', name: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
