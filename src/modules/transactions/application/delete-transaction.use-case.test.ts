import { describe, expect, it } from 'vitest';

import { Account } from '@/core/entities/account';
import { Transaction } from '@/core/entities/transaction';
import { FakeAccountRepository } from '@/tests/fakes/fake-account.repository';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';

import { DeleteTransactionUseCase } from './delete-transaction.use-case';

const USER_ID = 'user-1';

describe('DeleteTransactionUseCase', () => {
  it('reverts the balance effect and removes the transaction', async () => {
    const accountRepository = new FakeAccountRepository();
    await accountRepository.save(
      new Account({
        id: 'acc-1',
        userId: USER_ID,
        name: 'Conta',
        type: 'checking',
        balance: 150, // 100 opening + 50 income already applied
        currency: 'BRL',
        archived: false,
        hidden: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    const transactionRepository = new FakeTransactionRepository();
    await transactionRepository.save(
      new Transaction({
        id: 'tx-1',
        accountId: 'acc-1',
        description: 'Salário',
        amount: 50,
        type: 'income',
        occurredAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const useCase = new DeleteTransactionUseCase(
      transactionRepository,
      accountRepository,
    );
    await useCase.execute({ id: 'tx-1', userId: USER_ID });

    expect(await transactionRepository.findById('tx-1')).toBeNull();
    const account = await accountRepository.findById('acc-1');
    expect(account!.balance).toBe(100);
  });

  it('puts a deleted bill payment back on the card it had paid down', async () => {
    const accountRepository = new FakeAccountRepository();
    const transactionRepository = new FakeTransactionRepository();
    for (const [id, type, balance] of [
      ['checking-1', 'checking', 700],
      ['card-1', 'credit', 200],
    ] as const) {
      await accountRepository.save(
        new Account({
          id,
          userId: USER_ID,
          name: id,
          type,
          balance,
          currency: 'BRL',
          archived: false,
          hidden: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );
    }
    await transactionRepository.save(
      new Transaction({
        id: 'payment',
        accountId: 'checking-1',
        description: 'Pagamento de fatura',
        amount: 300,
        type: 'expense',
        settlesAccountId: 'card-1',
        occurredAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    await new DeleteTransactionUseCase(
      transactionRepository,
      accountRepository,
    ).execute({ id: 'payment', userId: USER_ID });

    expect((await accountRepository.findById('checking-1'))!.balance).toBe(
      1000,
    );
    expect((await accountRepository.findById('card-1'))!.balance).toBe(500);
  });
});
