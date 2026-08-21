import { describe, expect, it } from 'vitest';

import { Account } from '@/core/entities/account';
import { DomainError } from '@/core/errors/domain-error';
import { FakeAccountRepository } from '@/tests/fakes/fake-account.repository';

import { DeleteAccountUseCase } from './delete-account.use-case';

function seedAccount(repository: FakeAccountRepository) {
  return repository.save(
    new Account({
      id: 'acc-1',
      userId: 'user-1',
      name: 'Conta corrente',
      type: 'checking',
      balance: 0,
      currency: 'BRL',
      archived: false,
      hidden: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  );
}

describe('DeleteAccountUseCase', () => {
  it('actually deletes the account (regression: used to call save() instead)', async () => {
    const repository = new FakeAccountRepository();
    await seedAccount(repository);
    const useCase = new DeleteAccountUseCase(repository, async () => false);

    await useCase.execute({ id: 'acc-1' });

    expect(await repository.findById('acc-1')).toBeNull();
  });

  it('blocks deletion when the account has transactions', async () => {
    const repository = new FakeAccountRepository();
    await seedAccount(repository);
    const useCase = new DeleteAccountUseCase(repository, async () => true);

    await expect(useCase.execute({ id: 'acc-1' })).rejects.toBeInstanceOf(
      DomainError,
    );
    expect(await repository.findById('acc-1')).not.toBeNull();
  });
});
