import { describe, expect, it } from 'vitest';

import { FakeAccountRepository } from '@/tests/fakes/fake-account.repository';

import { CreateAccountUseCase } from './create-account.use-case';

describe('CreateAccountUseCase', () => {
  it('creates an account and persists it', async () => {
    const repository = new FakeAccountRepository();
    const useCase = new CreateAccountUseCase(repository);

    const account = await useCase.execute({
      id: 'acc-1',
      userId: 'user-1',
      name: 'Conta corrente',
      type: 'checking',
      balance: 100,
      currency: 'BRL',
    });

    expect(account.balance).toBe(100);
    expect(account.archived).toBe(false);
    expect(await repository.findById('acc-1')).not.toBeNull();
  });

  it('rejects a blank name', async () => {
    const useCase = new CreateAccountUseCase(new FakeAccountRepository());

    await expect(
      useCase.execute({
        id: 'acc-1',
        userId: 'user-1',
        name: '   ',
        type: 'checking',
        balance: 0,
        currency: 'BRL',
      }),
    ).rejects.toThrow('Account name is required.');
  });
});
