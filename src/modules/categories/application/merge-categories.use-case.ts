import type { BudgetRepository } from '@/core/contracts/budget-repository';
import type { CategoryRepository } from '@/core/contracts/category-repository';
import type { InstallmentPlanRepository } from '@/core/contracts/installment-plan-repository';
import type { MerchantRuleRepository } from '@/core/contracts/merchant-rule-repository';
import type { RecurringTransactionRepository } from '@/core/contracts/recurring-transaction-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import { Budget } from '@/core/entities/budget';
import { InstallmentPlan } from '@/core/entities/installment-plan';
import { MerchantRule } from '@/core/entities/merchant-rule';
import { RecurringTransaction } from '@/core/entities/recurring-transaction';
import { Transaction } from '@/core/entities/transaction';
import { DomainError } from '@/core/errors/domain-error';
import { NotFoundError } from '@/core/errors/not-found-error';

export interface MergeCategoriesInput {
  userId: string;
  /** The category that stays and receives everything. */
  keepId: string;
  /** The category that is the same thing and gets archived. */
  mergeId: string;
}

/** Transactions are moved a page at a time; the loop reads again until none are left. */
const TRANSACTION_PAGE_SIZE = 200;

/**
 * Merges two categories that are the same (spec 2026-10-19-contas-planejamento-categorias-design.md §5.2):
 * transactions, budgets, merchant rules, recurring transactions and
 * installment plans filed under the leaving category are re-filed under the
 * one that stays, and the leaving category is archived. Account balances do
 * not change, since only the category moves. The caller runs this in one
 * unit of work, so a failure leaves every row as it was.
 */
export class MergeCategoriesUseCase {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly transactions: TransactionRepository,
    private readonly budgets: BudgetRepository,
    private readonly merchantRules: MerchantRuleRepository,
    private readonly recurringTransactions: RecurringTransactionRepository,
    private readonly installmentPlans: InstallmentPlanRepository,
  ) {}

  /** Returns how many transactions moved. */
  async execute(input: MergeCategoriesInput): Promise<{ moved: number }> {
    const { userId, keepId, mergeId } = input;

    if (keepId === mergeId) {
      throw new DomainError(
        'A category cannot be merged into itself.',
        'SAME_CATEGORY',
      );
    }

    const keep = await this.categories.findById(keepId);
    if (!keep || keep.userId !== userId) {
      throw new NotFoundError('Category', keepId);
    }
    const merge = await this.categories.findById(mergeId);
    if (!merge || merge.userId !== userId) {
      throw new NotFoundError('Category', mergeId);
    }
    if (keep.archived) {
      throw new DomainError(
        'An archived category cannot receive new transactions.',
        'CATEGORY_ARCHIVED',
      );
    }

    const moved = await this.moveTransactions(userId, mergeId, keepId);

    for (const budget of await this.budgets.findByUserId(userId)) {
      if (budget.categoryId === mergeId) {
        await this.budgets.save(
          new Budget({
            ...budget.props,
            categoryId: keepId,
            updatedAt: new Date(),
          }),
        );
      }
    }
    for (const rule of await this.merchantRules.findByUserId(userId)) {
      if (rule.categoryId === mergeId) {
        await this.merchantRules.save(
          new MerchantRule({
            ...rule.props,
            categoryId: keepId,
            updatedAt: new Date(),
          }),
        );
      }
    }
    for (const rule of await this.recurringTransactions.findByUserId(userId)) {
      if (rule.categoryId === mergeId) {
        await this.recurringTransactions.save(
          new RecurringTransaction({
            ...rule.props,
            categoryId: keepId,
            updatedAt: new Date(),
          }),
        );
      }
    }
    for (const plan of await this.installmentPlans.findByUserId(userId)) {
      if (plan.categoryId === mergeId) {
        await this.installmentPlans.save(
          new InstallmentPlan({
            ...plan.props,
            categoryId: keepId,
            updatedAt: new Date(),
          }),
        );
      }
    }

    if (!merge.archived) {
      await this.categories.save(merge.archive());
    }

    return { moved };
  }

  /**
   * Re-files every transaction on the leaving category. Moved rows leave the
   * filter, so reading again from the top is safe; a read that returns a row
   * already moved means a save did not stick, so it stops instead of looping.
   */
  private async moveTransactions(
    userId: string,
    fromId: string,
    toId: string,
  ): Promise<number> {
    const moved = new Set<string>();
    for (;;) {
      const batch = await this.transactions.findByUserId(userId, {
        categoryId: fromId,
        pageSize: TRANSACTION_PAGE_SIZE,
      });
      if (batch.length === 0) return moved.size;

      for (const transaction of batch) {
        if (moved.has(transaction.id)) {
          throw new DomainError(
            'A transaction did not move to the category that stays.',
            'MERGE_STALLED',
          );
        }
        await this.transactions.save(
          new Transaction({
            ...transaction.props,
            categoryId: toId,
            updatedAt: new Date(),
          }),
        );
        moved.add(transaction.id);
      }
    }
  }
}
