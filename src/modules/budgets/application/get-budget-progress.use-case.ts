import type { BudgetRepository } from '@/core/contracts/budget-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import type { Budget } from '@/core/entities/budget';

export interface BudgetProgress {
  budget: Budget;
  spent: number;
  remaining: number;
  percentage: number;
}

/**
 * Budgets never persist "amount spent" (see `Budget` entity docs) — it is
 * always computed here, at read time, from the user's expense transactions
 * that fall inside the budget's category and period.
 */
export class GetBudgetProgressUseCase {
  constructor(
    private readonly budgetRepository: BudgetRepository,
    private readonly transactionRepository: TransactionRepository,
  ) {}

  async execute(userId: string): Promise<BudgetProgress[]> {
    const budgets = await this.budgetRepository.findByUserId(userId);

    return Promise.all(
      budgets.map(async (budget) => {
        const transactions = await this.transactionRepository.findByUserId(
          userId,
          {
            categoryId: budget.categoryId,
            type: 'expense',
            from: budget.periodStart,
            to: budget.periodEnd,
          },
        );

        const spent = transactions
          .filter((transaction) =>
            budget.period.contains(transaction.occurredAt),
          )
          .reduce((total, transaction) => total + transaction.amount, 0);

        return {
          budget,
          spent,
          remaining: budget.amount - spent,
          percentage: spent / budget.amount,
        };
      }),
    );
  }
}
