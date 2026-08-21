import { describe, expect, it } from 'vitest';

import { Account } from '@/core/entities/account';
import { Transaction } from '@/core/entities/transaction';
import { GetAccountsUseCase } from '@/modules/accounts/application/get-accounts.use-case';
import { FakeAccountRepository } from '@/tests/fakes/fake-account.repository';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';

describe('GetAccountsUseCase', () => {
  it('returns each account with its stored balance as projected, and current balance excluding future transactions', async () => {
    const accountRepository = new FakeAccountRepository();
    const transactionRepository = new FakeTransactionRepository();

    const account = new Account({
      id: 'acc-1',
      userId: 'user-1',
      name: 'Conta corrente',
      type: 'checking',
      balance: 835, // already includes a future -165 expense
      currency: 'BRL',
      archived: false,
      hidden: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await accountRepository.save(account);

    const future = new Transaction({
      id: 'tx-future',
      accountId: 'acc-1',
      description: 'Parcela futura',
      amount: 165,
      type: 'expense',
      occurredAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await transactionRepository.save(future);

    const result = await new GetAccountsUseCase(
      accountRepository,
      transactionRepository,
    ).execute('user-1');

    expect(result).toHaveLength(1);
    expect(result[0].projectedBalance).toBe(835);
    expect(result[0].currentBalance).toBe(1000);
  });

  it('current equals projected when there are no future transactions', async () => {
    const accountRepository = new FakeAccountRepository();
    const transactionRepository = new FakeTransactionRepository();

    await accountRepository.save(
      new Account({
        id: 'acc-1',
        userId: 'user-1',
        name: 'Conta',
        type: 'checking',
        balance: 500,
        currency: 'BRL',
        archived: false,
        hidden: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const result = await new GetAccountsUseCase(
      accountRepository,
      transactionRepository,
    ).execute('user-1');

    expect(result[0].currentBalance).toBe(500);
    expect(result[0].projectedBalance).toBe(500);
  });
});
