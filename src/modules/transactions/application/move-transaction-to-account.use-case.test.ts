import { beforeEach, describe, expect, it } from 'vitest';

import { Account } from '@/core/entities/account';
import { Transaction } from '@/core/entities/transaction';
import { FakeAccountRepository } from '@/tests/fakes/fake-account.repository';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';

import { MoveTransactionToAccountUseCase } from './move-transaction-to-account.use-case';

const USER_ID = 'user-1';

function account(
  id: string,
  type: 'checking' | 'credit',
  balance: number,
  overrides: Partial<ConstructorParameters<typeof Account>[0]> = {},
) {
  return new Account({
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
    ...overrides,
  });
}

describe('MoveTransactionToAccountUseCase', () => {
  let accounts: FakeAccountRepository;
  let transactions: FakeTransactionRepository;
  let move: MoveTransactionToAccountUseCase;

  beforeEach(async () => {
    accounts = new FakeAccountRepository();
    transactions = new FakeTransactionRepository();
    move = new MoveTransactionToAccountUseCase(transactions, accounts);
    // R$ 23,90 already on the card's bill.
    await accounts.save(account('card', 'credit', 23.9));
    await accounts.save(account('checking', 'checking', 1000));
    await transactions.save(
      new Transaction({
        id: 'tx-1',
        accountId: 'card',
        description: 'Padaria Real',
        amount: 23.9,
        type: 'expense',
        occurredAt: new Date(2026, 9, 19, 12, 41),
        source: 'wallet',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  });

  it('takes a purchase off the card and out of the checking account instead', async () => {
    const moved = await move.execute({
      userId: USER_ID,
      transactionId: 'tx-1',
      accountId: 'checking',
    });

    expect(moved).toMatchObject({
      id: 'tx-1',
      accountId: 'checking',
      source: 'wallet',
    });
    expect((await accounts.findById('card'))?.balance).toBe(0);
    expect((await accounts.findById('checking'))?.balance).toBe(976.1);
    expect((await transactions.findById('tx-1'))?.accountId).toBe('checking');
  });

  it("refuses an archived account or someone else's", async () => {
    await accounts.save(account('old', 'checking', 0, { archived: true }));
    await accounts.save(
      account('theirs', 'checking', 0, { userId: 'someone-else' }),
    );

    await expect(
      move.execute({
        userId: USER_ID,
        transactionId: 'tx-1',
        accountId: 'old',
      }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_ARCHIVED' });
    await expect(
      move.execute({
        userId: USER_ID,
        transactionId: 'tx-1',
        accountId: 'theirs',
      }),
    ).rejects.toMatchObject({ name: 'NotFoundError' });
    await expect(
      move.execute({
        userId: 'someone-else',
        transactionId: 'tx-1',
        accountId: 'checking',
      }),
    ).rejects.toMatchObject({ name: 'NotFoundError' });
  });
});
