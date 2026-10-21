import { beforeEach, describe, expect, it } from 'vitest';

import { Account } from '@/core/entities/account';
import { Category } from '@/core/entities/category';
import { Transaction } from '@/core/entities/transaction';
import { NotFoundError } from '@/core/errors/not-found-error';
import { sameCategoryName } from '@/modules/categories/domain/category-catalog';
import { FakeAccountRepository } from '@/tests/fakes/fake-account.repository';
import { FakeCategoryRepository } from '@/tests/fakes/fake-category.repository';
import { FakeMerchantRuleRepository } from '@/tests/fakes/fake-merchant-rule.repository';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';

import { FileUnderNewCategoryUseCase } from './file-under-new-category.use-case';

const userId = 'user-1';

function card(id: string, owner: string) {
  return new Account({
    id,
    userId: owner,
    name: 'Nubank Crédito',
    type: 'credit',
    balance: 0,
    currency: 'BRL',
    archived: false,
    hidden: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function purchase(id: string, description: string, accountId = 'card-1') {
  return new Transaction({
    id,
    accountId,
    description,
    amount: 23.9,
    type: 'expense',
    occurredAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('FileUnderNewCategoryUseCase', () => {
  let transactions: FakeTransactionRepository;
  let accounts: FakeAccountRepository;
  let categories: FakeCategoryRepository;
  let rules: FakeMerchantRuleRepository;
  let fileUnder: FileUnderNewCategoryUseCase;
  let farmacia: Transaction;
  let outraFarmacia: Transaction;
  let f1: Transaction;
  let f2: Transaction;
  let f3: Transaction;

  beforeEach(async () => {
    transactions = new FakeTransactionRepository();
    accounts = new FakeAccountRepository();
    categories = new FakeCategoryRepository();
    rules = new FakeMerchantRuleRepository();
    fileUnder = new FileUnderNewCategoryUseCase(
      transactions,
      accounts,
      categories,
      rules,
    );

    await accounts.save(card('card-1', userId));
    farmacia = purchase('tx-farmacia', 'FARMÁCIA SÃO JOÃO S/A');
    outraFarmacia = purchase('tx-drogasil', 'Drogasil 24h');
    f1 = purchase('tx-1', 'Mercado Bom');
    f2 = purchase('tx-2', 'Loja Azul');
    f3 = purchase('tx-3', 'Papelaria Central');
    for (const t of [farmacia, outraFarmacia, f1, f2, f3]) {
      await transactions.save(t);
    }
  });

  it('creates the category, files the purchase and remembers the merchant', async () => {
    const { category, created } = await fileUnder.execute({
      userId,
      name: 'Saúde',
      color: '#ef4444',
      transactionIds: [farmacia.id],
    });
    expect(created).toBe(true);
    expect((await transactions.findById(farmacia.id))?.categoryId).toBe(
      category.id,
    );
    expect(
      (await rules.findByKey(userId, 'farmacia sao joao'))?.categoryId,
    ).toBe(category.id);
  });
  it('reuses a category of the same name instead of making a second one', async () => {
    await fileUnder.execute({
      userId,
      name: 'Saúde',
      transactionIds: [farmacia.id],
    });
    const again = await fileUnder.execute({
      userId,
      name: 'saude',
      transactionIds: [outraFarmacia.id],
    });
    expect(again.created).toBe(false);
    expect(
      (await categories.findByUserId(userId)).filter((c) =>
        sameCategoryName(c.name, 'Saúde'),
      ),
    ).toHaveLength(1);
  });
  it('files several purchases at once', async () => {
    const { category } = await fileUnder.execute({
      userId,
      name: 'Saúde',
      transactionIds: [f1.id, f2.id, f3.id],
    });
    for (const id of [f1.id, f2.id, f3.id])
      expect((await transactions.findById(id))?.categoryId).toBe(category.id);
  });
  it('refuses an empty name', async () => {
    await expect(
      fileUnder.execute({ userId, name: '  ', transactionIds: [] }),
    ).rejects.toThrow();
  });

  it('creates a new one when the only category of that name is archived', async () => {
    await categories.save(
      new Category({
        id: 'saude-antiga',
        userId,
        name: 'Saúde',
        archived: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const { category, created } = await fileUnder.execute({
      userId,
      name: 'Saúde',
      transactionIds: [farmacia.id],
    });

    expect(created).toBe(true);
    expect(category.id).not.toBe('saude-antiga');
    expect(category.archived).toBe(false);
    expect((await transactions.findById(farmacia.id))?.categoryId).toBe(
      category.id,
    );
  });

  it("refuses another user's transaction", async () => {
    await accounts.save(card('card-alheio', 'someone-else'));
    const alheia = purchase('tx-alheia', 'Drogaria Outra', 'card-alheio');
    await transactions.save(alheia);

    await expect(
      fileUnder.execute({
        userId,
        name: 'Saúde',
        transactionIds: [alheia.id],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(
      (await transactions.findById(alheia.id))?.categoryId,
    ).toBeUndefined();
  });
});
