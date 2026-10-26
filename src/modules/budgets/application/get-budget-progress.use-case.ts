import type { BudgetRepository } from '@/core/contracts/budget-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import type { Budget } from '@/core/entities/budget';
import type { DateRange } from '@/core/value-objects/date-range';

export interface BudgetProgress {
  budget: Budget;
  /** The period measured: a fixed budget's own dates, or the month asked about. */
  period: DateRange;
  /** The limit in force on the day asked about. */
  amount: number;
  /** Whether the budget is in force on the day asked about. */
  running: boolean;
  spent: number;
  remaining: number;
  percentage: number;
}

/**
 * Budgets never persist "amount spent" (see `Budget` entity docs) — it is
 * always computed here, at read time, from the user's expense transactions
 * that fall inside the budget's category and period. A monthly budget is
 * measured over the month of `at`, a fixed one over its own dates.
 */
export class GetBudgetProgressUseCase {
  constructor(
    private readonly budgetRepository: BudgetRepository,
    private readonly transactionRepository: TransactionRepository,
  ) {}

  async execute(
    userId: string,
    at: Date = new Date(),
  ): Promise<BudgetProgress[]> {
    const budgets = await this.budgetRepository.findByUserId(userId);

    return Promise.all(
      budgets.map(async (budget) => {
        const period = budget.periodFor(at);
        const amount = budget.amountFor(at);
        const transactions = await this.transactionRepository.findByUserId(
          userId,
          {
            categoryId: budget.categoryId,
            type: 'expense',
            from: period.start,
            to: period.end,
            // Every purchase in the period, not the repository's first page.
            pageSize: 10_000,
          },
        );

        const spent = transactions
          .filter(
            (transaction) =>
              transaction.countsAs('expense') &&
              period.contains(transaction.occurredAt),
          )
          .reduce((total, transaction) => total + transaction.amount, 0);

        return {
          budget,
          period,
          amount,
          running: budget.runsOn(at),
          spent,
          remaining: amount - spent,
          percentage: spent / amount,
        };
      }),
    );
  }
}
