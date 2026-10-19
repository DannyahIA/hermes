import { beforeEach, describe, expect, it } from 'vitest';

import { Account } from '@/core/entities/account';
import { Category } from '@/core/entities/category';
import { Transaction } from '@/core/entities/transaction';
import { DomainError } from '@/core/errors/domain-error';
import { NotFoundError } from '@/core/errors/not-found-error';
import { FakeAccountRepository } from '@/tests/fakes/fake-account.repository';
import { FakeCategoryRepository } from '@/tests/fakes/fake-category.repository';
import { FakeMerchantRuleRepository } from '@/tests/fakes/fake-merchant-rule.repository';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';

import { CategorizeTransactionUseCase } from './categorize-transaction.use-case';

const USER_ID = 'user-1';

function category(
  id: string,
  overrides: { userId?: string; archived?: boolean } = {},
) {
  return new Category({
    id,
    userId: overrides.userId ?? USER_ID,
    name: id,
    archived: overrides.archived ?? false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function purchase(
  id: string,
  description: string,
  type: Transaction['type'] = 'expense',
) {
  return new Transaction({
    id,
    accountId: 'card-1',
    description,
    amount: 23.9,
    type,
    occurredAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('CategorizeTransactionUseCase', () => {
  let transactions: FakeTransactionRepository;
  let accounts: FakeAccountRepository;
  let rules: FakeMerchantRuleRepository;
  let useCase: CategorizeTransactionUseCase;

  beforeEach(async () => {
    transactions = new FakeTransactionRepository();
    accounts = new FakeAccountRepository();
    rules = new FakeMerchantRuleRepository();
    const categories = new FakeCategoryRepository();
    useCase = new CategorizeTransactionUseCase(
      transactions,
      accounts,
      categories,
      rules,
    );

    await accounts.save(
      new Account({
        id: 'card-1',
        userId: USER_ID,
        name: 'Nubank Crédito',
        type: 'credit',
        balance: 23.9,
        currency: 'BRL',
        archived: false,
        hidden: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    for (const c of [
      category('restaurantes'),
      category('lazer'),
      category('antiga', { archived: true }),
      category('alheia', { userId: 'someone-else' }),
    ]) {
      await categories.save(c);
    }
    await transactions.save(purchase('tx-1', 'PADARIA REAL LTDA *123'));
    await transactions.save(purchase('tx-2', 'Padaria Real'));
  });

  it('files the transaction and remembers the category for the merchant', async () => {
    const { transaction, rule } = await useCase.execute({
      userId: USER_ID,
      transactionId: 'tx-1',
      categoryId: 'restaurantes',
    });

    expect(transaction.categoryId).toBe('restaurantes');
    expect((await transactions.findById('tx-1'))!.categoryId).toBe(
      'restaurantes',
    );
    expect(rule).toMatchObject({
      merchantKey: 'padaria real',
      displayName: 'Padaria Real',
      categoryId: 'restaurantes',
      hits: 1,
    });
    // The card's balance doesn't move.
    expect((await accounts.findById('card-1'))!.balance).toBe(23.9);
  });

  it('strengthens the rule when the same category is chosen again, and replaces it otherwise', async () => {
    await useCase.execute({
      userId: USER_ID,
      transactionId: 'tx-1',
      categoryId: 'restaurantes',
    });
    await useCase.execute({
      userId: USER_ID,
      transactionId: 'tx-2',
      categoryId: 'restaurantes',
    });
    expect(await rules.findByKey(USER_ID, 'padaria real')).toMatchObject({
      categoryId: 'restaurantes',
      hits: 2,
    });

    await useCase.execute({
      userId: USER_ID,
      transactionId: 'tx-2',
      categoryId: 'lazer',
    });
    expect(await rules.findByKey(USER_ID, 'padaria real')).toMatchObject({
      categoryId: 'lazer',
      hits: 1,
    });
  });

  it("refuses another user's category and an archived one", async () => {
    await expect(
      useCase.execute({
        userId: USER_ID,
        transactionId: 'tx-1',
        categoryId: 'alheia',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      useCase.execute({
        userId: USER_ID,
        transactionId: 'tx-1',
        categoryId: 'antiga',
      }),
    ).rejects.toBeInstanceOf(DomainError);
    expect((await transactions.findById('tx-1'))!.categoryId).toBeUndefined();
  });

  it("refuses another user's transaction", async () => {
    await expect(
      useCase.execute({
        userId: 'someone-else',
        transactionId: 'tx-1',
        categoryId: 'restaurantes',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('does not categorize a transfer', async () => {
    await transactions.save(purchase('tx-3', 'Para a reserva', 'transfer'));

    await expect(
      useCase.execute({
        userId: USER_ID,
        transactionId: 'tx-3',
        categoryId: 'lazer',
      }),
    ).rejects.toMatchObject({ code: 'TRANSFER_HAS_NO_CATEGORY' });
  });

  it('does not categorize a card bill payment', async () => {
    await transactions.save(
      new Transaction({
        ...purchase('tx-4', 'Pagamento de fatura').props,
        settlesAccountId: 'card-1',
      }),
    );

    await expect(
      useCase.execute({
        userId: USER_ID,
        transactionId: 'tx-4',
        categoryId: 'lazer',
      }),
    ).rejects.toMatchObject({ code: 'BILL_PAYMENT_HAS_NO_CATEGORY' });
    expect((await transactions.findById('tx-4'))?.categoryId).toBeUndefined();
    expect(await rules.findByUserId(USER_ID)).toEqual([]);
  });
});
