import { describe, expect, it } from 'vitest';

import { Account } from '@/core/entities/account';
import { DomainError } from '@/core/errors/domain-error';
import { FakeAccountRepository } from '@/tests/fakes/fake-account.repository';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';

import { TransferMoneyUseCase } from './transfer-money.use-case';

const USER_ID = 'user-1';

function makeAccount(id: string, balance: number, userId = USER_ID) {
  return new Account({
    id,
    userId,
    name: id,
    type: 'checking',
    balance,
    currency: 'BRL',
    archived: false,
    hidden: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('TransferMoneyUseCase', () => {
  it('moves money between accounts without changing net worth', async () => {
    const accountRepository = new FakeAccountRepository();
    await accountRepository.save(makeAccount('from', 100));
    await accountRepository.save(makeAccount('to', 20));
    const transactionRepository = new FakeTransactionRepository();
    const useCase = new TransferMoneyUseCase(
      transactionRepository,
      accountRepository,
    );

    const [outgoing, incoming] = await useCase.execute({
      userId: USER_ID,
      fromAccountId: 'from',
      toAccountId: 'to',
      amount: 30,
      description: 'Transferência',
    });

    expect(outgoing.type).toBe('transfer');
    expect(incoming.type).toBe('transfer');
    expect(outgoing.id).not.toBe(incoming.id);

    const from = await accountRepository.findById('from');
    const to = await accountRepository.findById('to');
    expect(from!.balance).toBe(70);
    expect(to!.balance).toBe(50);
    expect(from!.balance + to!.balance).toBe(120);
  });

  it('rejects a transfer to the same account', async () => {
    const accountRepository = new FakeAccountRepository();
    await accountRepository.save(makeAccount('acc-1', 100));
    const useCase = new TransferMoneyUseCase(
      new FakeTransactionRepository(),
      accountRepository,
    );

    await expect(
      useCase.execute({
        userId: USER_ID,
        fromAccountId: 'acc-1',
        toAccountId: 'acc-1',
        amount: 10,
        description: 'x',
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("rejects a transfer involving another user's account", async () => {
    const accountRepository = new FakeAccountRepository();
    await accountRepository.save(makeAccount('from', 100));
    await accountRepository.save(makeAccount('to', 0, 'other-user'));
    const useCase = new TransferMoneyUseCase(
      new FakeTransactionRepository(),
      accountRepository,
    );

    await expect(
      useCase.execute({
        userId: USER_ID,
        fromAccountId: 'from',
        toAccountId: 'to',
        amount: 10,
        description: 'x',
      }),
    ).rejects.toThrow();
  });
});
