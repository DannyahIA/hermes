import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Budget } from '@/core/entities/budget';
import { Category } from '@/core/entities/category';
import { InstallmentPlan } from '@/core/entities/installment-plan';
import { MerchantRule } from '@/core/entities/merchant-rule';
import { RecurringTransaction } from '@/core/entities/recurring-transaction';
import { Transaction } from '@/core/entities/transaction';
import { DomainError } from '@/core/errors/domain-error';
import { FakeBudgetRepository } from '@/tests/fakes/fake-budget.repository';
import { FakeCategoryRepository } from '@/tests/fakes/fake-category.repository';
import { FakeInstallmentPlanRepository } from '@/tests/fakes/fake-installment-plan.repository';
import { FakeMerchantRuleRepository } from '@/tests/fakes/fake-merchant-rule.repository';
import { FakeRecurringTransactionRepository } from '@/tests/fakes/fake-recurring-transaction.repository';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';

import { MergeCategoriesUseCase } from './merge-categories.use-case';

const NOW = new Date('2026-10-20T12:00:00.000Z');
const userId = 'user-1';

function category(id: string, archived = false) {
  return new Category({
    id,
    userId,
    name: id,
    archived,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function expense(id: string, categoryId: string) {
  return new Transaction({
    id,
    accountId: 'account-1',
    categoryId,
    description: `Purchase ${id}`,
    amount: 25,
    type: 'expense',
    occurredAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

describe('MergeCategoriesUseCase', () => {
  let categories: FakeCategoryRepository;
  let transactions: FakeTransactionRepository;
  let budgets: FakeBudgetRepository;
  let rules: FakeMerchantRuleRepository;
  let recurring: FakeRecurringTransactionRepository;
  let plans: FakeInstallmentPlanRepository;
  let merge: MergeCategoriesUseCase;
  let mercado: Category;
  let supermercado: Category;
  let arquivada: Category;
  let budgetSupermercado: Budget;
  let assinaturaSupermercado: RecurringTransaction;

  beforeEach(async () => {
    categories = new FakeCategoryRepository();
    transactions = new FakeTransactionRepository();
    budgets = new FakeBudgetRepository();
    rules = new FakeMerchantRuleRepository();
    recurring = new FakeRecurringTransactionRepository();
    plans = new FakeInstallmentPlanRepository();
    merge = new MergeCategoriesUseCase(
      categories,
      transactions,
      budgets,
      rules,
      recurring,
      plans,
    );

    mercado = category('mercado');
    supermercado = category('supermercado');
    arquivada = category('arquivada', true);
    await categories.save(mercado);
    await categories.save(supermercado);
    await categories.save(arquivada);

    await transactions.save(expense('almoco', supermercado.id));
    await transactions.save(expense('compras', supermercado.id));

    budgetSupermercado = new Budget({
      id: 'budget-supermercado',
      userId,
      categoryId: supermercado.id,
      amount: 800,
      currency: 'BRL',
      kind: 'fixed',
      limits: [],
      periodStart: new Date('2026-10-01T00:00:00.000Z'),
      periodEnd: new Date('2026-10-31T23:59:59.999Z'),
      createdAt: NOW,
      updatedAt: NOW,
    });
    await budgets.save(budgetSupermercado);

    await rules.save(
      new MerchantRule({
        id: 'rule-condor',
        userId,
        merchantKey: 'condor',
        displayName: 'Condor',
        categoryId: supermercado.id,
        hits: 3,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    );

    assinaturaSupermercado = new RecurringTransaction({
      id: 'recurring-assinatura',
      userId,
      accountId: 'account-1',
      categoryId: supermercado.id,
      description: 'Streaming',
      amount: 30,
      type: 'expense',
      dayRuleKind: 'fixed_day',
      dayRuleDay: 8,
      startDate: new Date('2026-01-08T00:00:00.000Z'),
      active: true,
      createdAt: NOW,
      updatedAt: NOW,
    });
    await recurring.save(assinaturaSupermercado);
  });

  it('moves everything to the category that stays and archives the other', async () => {
    const { moved } = await merge.execute({
      userId,
      keepId: mercado.id,
      mergeId: supermercado.id,
    });
    expect(moved).toBe(2);
    expect(
      (await transactions.findByUserId(userId, { categoryId: supermercado.id }))
        .length,
    ).toBe(0);
    expect((await budgets.findById(budgetSupermercado.id))?.categoryId).toBe(
      mercado.id,
    );
    expect((await rules.findByKey(userId, 'condor'))?.categoryId).toBe(
      mercado.id,
    );
    expect(
      (await recurring.findById(assinaturaSupermercado.id))?.categoryId,
    ).toBe(mercado.id);
    expect((await categories.findById(supermercado.id))?.archived).toBe(true);
  });

  it('refuses merging a category into itself, into an archived one, or someone else’s', async () => {
    await expect(
      merge.execute({ userId, keepId: mercado.id, mergeId: mercado.id }),
    ).rejects.toBeInstanceOf(DomainError);
    await expect(
      merge.execute({ userId, keepId: arquivada.id, mergeId: supermercado.id }),
    ).rejects.toMatchObject({ code: 'CATEGORY_ARCHIVED' });
    await expect(
      merge.execute({
        userId: 'user-2',
        keepId: mercado.id,
        mergeId: supermercado.id,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('moves an installment plan to the category that stays', async () => {
    const plan = new InstallmentPlan({
      id: 'plan-panela',
      userId,
      accountId: 'account-1',
      categoryId: supermercado.id,
      description: 'Panela',
      kind: 'purchase',
      totalAmount: 600,
      installmentCount: 3,
      createdAt: NOW,
      updatedAt: NOW,
    });
    await plans.save(plan);

    await merge.execute({
      userId,
      keepId: mercado.id,
      mergeId: supermercado.id,
    });

    expect((await plans.findById(plan.id))?.categoryId).toBe(mercado.id);
  });

  it('moves every transaction, not only the first page of them', async () => {
    // Only the 450 transactions saved below stay on the leaving category.
    await transactions.delete('almoco');
    await transactions.delete('compras');
    for (let i = 0; i < 450; i++) {
      await transactions.save(expense(`compra-${i}`, supermercado.id));
    }

    const { moved } = await merge.execute({
      userId,
      keepId: mercado.id,
      mergeId: supermercado.id,
    });

    expect(moved).toBe(450);
    expect(
      await transactions.findByUserId(userId, {
        categoryId: supermercado.id,
        pageSize: 1000,
      }),
    ).toHaveLength(0);
    expect(
      await transactions.findByUserId(userId, {
        categoryId: mercado.id,
        pageSize: 1000,
      }),
    ).toHaveLength(450);
  });

  it('moves the transactions of an already archived category too', async () => {
    await transactions.save(expense('antigo', arquivada.id));

    const { moved } = await merge.execute({
      userId,
      keepId: mercado.id,
      mergeId: arquivada.id,
    });

    expect(moved).toBe(1);
    expect((await transactions.findById('antigo'))?.categoryId).toBe(
      mercado.id,
    );
    expect((await categories.findById(arquivada.id))?.archived).toBe(true);
  });

  it('stops with an error when a moved transaction comes back instead of looping', async () => {
    const stuck = new FakeTransactionRepository();
    await stuck.save(expense('almoco', supermercado.id));
    // The save reports success but leaves the old category in place.
    vi.spyOn(stuck, 'save').mockResolvedValue(undefined);
    const useCase = new MergeCategoriesUseCase(
      categories,
      stuck,
      budgets,
      rules,
      recurring,
      plans,
    );

    await expect(
      useCase.execute({ userId, keepId: mercado.id, mergeId: supermercado.id }),
    ).rejects.toMatchObject({ code: 'MERGE_STALLED' });
  });
});
