import { describe, expect, it } from 'vitest';

import { loadAccountDetails } from '@/app/accounts/load-account-details';
import { Account } from '@/core/entities/account';
import { Transaction } from '@/core/entities/transaction';
import { FakeAccountRepository } from '@/tests/fakes/fake-account.repository';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';

const now = new Date(2026, 9, 26, 12);

function account(
  id: string,
  type: 'checking' | 'credit',
  extra: Partial<ConstructorParameters<typeof Account>[0]> = {},
) {
  return new Account({
    id,
    userId: 'user-1',
    name: id,
    type,
    balance: 0,
    currency: 'BRL',
    archived: false,
    hidden: false,
    createdAt: now,
    updatedAt: now,
    ...extra,
  });
}

function transaction(
  id: string,
  accountId: string,
  occurredAt: Date,
  amount = 10,
  type: 'income' | 'expense' = 'expense',
) {
  return new Transaction({
    id,
    accountId,
    description: `Compra ${id}`,
    amount,
    type,
    occurredAt,
    createdAt: now,
    updatedAt: now,
  });
}

async function setup() {
  const accounts = new FakeAccountRepository();
  const transactions = new FakeTransactionRepository();
  return { accounts, transactions };
}

describe('loadAccountDetails', () => {
  it('keeps the 5 latest transactions up to today, newest first, as plain data', async () => {
    const { accounts, transactions } = await setup();
    await accounts.save(account('corrente', 'checking'));
    for (let day = 1; day <= 7; day++) {
      await transactions.save(
        transaction(`t${day}`, 'corrente', new Date(2026, 9, day, 9)),
      );
    }
    await transactions.save(
      transaction('future', 'corrente', new Date(2026, 9, 30, 9)),
    );
    await transactions.save(
      transaction('other', 'outra', new Date(2026, 9, 25, 9)),
    );

    const { recent } = await loadAccountDetails(
      accounts,
      transactions,
      'user-1',
      ['corrente'],
      now,
    );

    expect(recent.corrente.map((line) => line.id)).toEqual([
      't7',
      't6',
      't5',
      't4',
      't3',
    ]);
    expect(recent.corrente[0]).toEqual({
      id: 't7',
      description: 'Compra t7',
      amount: 10,
      type: 'expense',
      occurredAt: new Date(2026, 9, 7, 9).toISOString(),
      occurredLabel: '7 de out. de 2026',
    });
  });

  it('gives an account without transactions an empty list', async () => {
    const { accounts, transactions } = await setup();
    const { recent } = await loadAccountDetails(
      accounts,
      transactions,
      'user-1',
      ['vazia'],
      now,
    );
    expect(recent.vazia).toEqual([]);
  });

  it('maps a card statement to the open bill, the closed bill and the due date', async () => {
    const { accounts, transactions } = await setup();
    // Closes on the 10th, due on the 17th. Owes 900: 400 since the closing
    // of Oct 10, so 500 is left on the closed bill.
    await accounts.save(
      account('cartao', 'credit', { balance: 900, closingDay: 10, dueDay: 17 }),
    );
    await transactions.save(
      transaction('compra', 'cartao', new Date(2026, 9, 15, 9), 400),
    );

    const { statements } = await loadAccountDetails(
      accounts,
      transactions,
      'user-1',
      ['cartao'],
      now,
    );

    expect(statements.cartao).toEqual({
      open: 400,
      closed: 500,
      dueLabel: '17 de nov. de 2026',
    });
  });

  it('leaves out cards without a closing and a due day, and accounts that are not cards', async () => {
    const { accounts, transactions } = await setup();
    await accounts.save(account('corrente', 'checking'));
    await accounts.save(account('sem-ciclo', 'credit', { balance: 100 }));

    const { statements } = await loadAccountDetails(
      accounts,
      transactions,
      'user-1',
      ['corrente', 'sem-ciclo'],
      now,
    );

    expect(statements).toEqual({});
  });
});
