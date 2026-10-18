import { beforeEach, describe, expect, it } from 'vitest';

import { Account } from '@/core/entities/account';
import { Category } from '@/core/entities/category';
import { NotFoundError } from '@/core/errors/not-found-error';
import { FakeAccountRepository } from '@/tests/fakes/fake-account.repository';
import { FakeCategoryRepository } from '@/tests/fakes/fake-category.repository';
import { FakeMerchantRuleRepository } from '@/tests/fakes/fake-merchant-rule.repository';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';

import { RecordQuickEntryUseCase } from './record-quick-entry.use-case';

const USER_ID = 'user-1';
const WHEN = new Date(2026, 9, 18, 12, 41);

function account(id: string, type: Account['type'], userId = USER_ID) {
  return new Account({
    id,
    userId,
    name: id,
    type,
    balance: 0,
    currency: 'BRL',
    archived: false,
    hidden: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('RecordQuickEntryUseCase', () => {
  let transactions: FakeTransactionRepository;
  let accounts: FakeAccountRepository;
  let rules: FakeMerchantRuleRepository;
  let useCase: RecordQuickEntryUseCase;

  beforeEach(async () => {
    transactions = new FakeTransactionRepository();
    accounts = new FakeAccountRepository();
    rules = new FakeMerchantRuleRepository();
    const categories = new FakeCategoryRepository();
    useCase = new RecordQuickEntryUseCase(
      transactions,
      accounts,
      categories,
      rules,
    );

    await accounts.save(account('card', 'credit'));
    await accounts.save(account('checking', 'checking'));
    await categories.save(
      new Category({
        id: 'restaurantes',
        userId: USER_ID,
        name: 'Restaurantes',
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  });

  it('records the entry at the moment given and moves the balance', async () => {
    const { transaction } = await useCase.execute({
      id: 'tx-1',
      userId: USER_ID,
      accountId: 'card',
      description: 'Padaria Real',
      amount: 23.9,
      type: 'expense',
      occurredAt: WHEN,
    });

    expect(transaction.occurredAt).toEqual(WHEN);
    expect(await transactions.findById('tx-1')).not.toBeNull();
    // On a card, spending is debt: the balance owed goes up.
    expect((await accounts.findById('card'))?.balance).toBe(23.9);
  });

  it('remembers the category for the merchant', async () => {
    const { rule } = await useCase.execute({
      id: 'tx-1',
      userId: USER_ID,
      accountId: 'card',
      categoryId: 'restaurantes',
      description: 'Padaria Real',
      amount: 23.9,
      type: 'expense',
      occurredAt: WHEN,
    });

    expect(rule?.merchantKey).toBe('padaria real');
    expect((await rules.findByKey(USER_ID, 'padaria real'))?.categoryId).toBe(
      'restaurantes',
    );
  });

  it('remembers nothing when no category was chosen', async () => {
    const { rule } = await useCase.execute({
      id: 'tx-1',
      userId: USER_ID,
      accountId: 'checking',
      description: 'Pix recebido',
      amount: 50,
      type: 'income',
      occurredAt: WHEN,
    });

    expect(rule).toBeNull();
    expect(await rules.findByUserId(USER_ID)).toEqual([]);
  });

  it("refuses someone else's account and records nothing", async () => {
    await accounts.save(account('other', 'checking', 'user-2'));

    await expect(
      useCase.execute({
        id: 'tx-1',
        userId: USER_ID,
        accountId: 'other',
        categoryId: 'restaurantes',
        description: 'Padaria Real',
        amount: 23.9,
        type: 'expense',
        occurredAt: WHEN,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(await transactions.findById('tx-1')).toBeNull();
    expect(await rules.findByUserId(USER_ID)).toEqual([]);
  });
});
