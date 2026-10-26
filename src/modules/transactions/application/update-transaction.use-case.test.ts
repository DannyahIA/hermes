import { describe, expect, it } from 'vitest';

import { Account } from '@/core/entities/account';
import { Transaction } from '@/core/entities/transaction';
import { FakeAccountRepository } from '@/tests/fakes/fake-account.repository';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';

import { UpdateTransactionUseCase } from './update-transaction.use-case';

const USER_ID = 'user-1';

async function setup() {
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
  const useCase = new UpdateTransactionUseCase(
    transactionRepository,
    accountRepository,
  );
  return { accountRepository, transactionRepository, useCase };
}

describe('UpdateTransactionUseCase', () => {
  it('moves the account balance by the change in amount', async () => {
    const { accountRepository, transactionRepository, useCase } = await setup();
    await transactionRepository.save(
      new Transaction({
        id: 'tx-1',
        accountId: 'checking-1',
        description: 'Mercado',
        amount: 100,
        type: 'expense',
        occurredAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    await useCase.execute({ id: 'tx-1', userId: USER_ID, amount: 150 });

    expect((await accountRepository.findById('checking-1'))!.balance).toBe(650);
  });

  it('moves the settled card’s debt too when a bill payment’s amount changes', async () => {
    const { accountRepository, transactionRepository, useCase } = await setup();
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

    const updated = await useCase.execute({
      id: 'payment',
      userId: USER_ID,
      amount: 250,
    });

    expect(updated.settlesAccountId).toBe('card-1');
    expect((await accountRepository.findById('checking-1'))!.balance).toBe(750);
    expect((await accountRepository.findById('card-1'))!.balance).toBe(250);
  });

  it('hands back the transaction as it was and as it is now', async () => {
    const { transactionRepository, useCase } = await setup();
    await transactionRepository.save(
      new Transaction({
        id: 'tx-1',
        accountId: 'checking-1',
        description: 'Mercdo',
        amount: 100,
        type: 'expense',
        occurredAt: new Date(2026, 9, 20),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const { before, after } = await useCase.executeWithBefore({
      id: 'tx-1',
      userId: USER_ID,
      description: 'Mercado',
      amount: 150,
    });

    expect(before.description).toBe('Mercdo');
    expect(before.amount).toBe(100);
    expect(after.description).toBe('Mercado');
    expect(after.amount).toBe(150);
  });
});
