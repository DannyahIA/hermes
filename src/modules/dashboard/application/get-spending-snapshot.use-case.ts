import type { AccountRepository } from '@/core/contracts/account-repository';
import type { BudgetRepository } from '@/core/contracts/budget-repository';
import type { RecurringTransactionRepository } from '@/core/contracts/recurring-transaction-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import { GetBudgetProgressUseCase } from '@/modules/budgets/application/get-budget-progress.use-case';

import { loadCurrentBalances } from './current-balances';
import {
  type AvailableToSpend,
  calculateAvailableToSpend,
} from './metrics/calculate-available-to-spend';
import {
  type BudgetPace,
  calculateBudgetPace,
} from './metrics/calculate-budget-pace';
import {
  calculateCardStatements,
  type CardStatement,
} from './metrics/calculate-card-statements';

export interface SpendingSnapshot {
  /** Null without a checking account to spend from. */
  available: AvailableToSpend | null;
  /** Budgets running today. */
  budgets: BudgetPace[];
}

/**
 * The two numbers a payment's chat message repeats from the Início — what
 * is still free, and how the budgets are pacing — computed the same way
 * but without the rest of the Início's summary.
 */
export class GetSpendingSnapshotUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly budgetRepository: BudgetRepository,
    private readonly recurringTransactionRepository: RecurringTransactionRepository,
  ) {}

  async execute(userId: string, now = new Date()): Promise<SpendingSnapshot> {
    const [{ balances, futureTransactions }, recurringRules, budgetProgress] =
      await Promise.all([
        loadCurrentBalances(
          this.accountRepository,
          this.transactionRepository,
          userId,
          now,
        ),
        this.recurringTransactionRepository.findByUserId(userId),
        new GetBudgetProgressUseCase(
          this.budgetRepository,
          this.transactionRepository,
        ).execute(userId, now),
      ]);

    return {
      available: calculateAvailableToSpend({
        balances,
        recurringRules,
        futureTransactions,
        today: now,
      }),
      budgets: calculateBudgetPace(budgetProgress, now),
    };
  }
}

/**
 * Each visible card's open and closed statements (the Início's "Cartões",
 * spec 2026-10-17-inicio-hub-design.md §4.3), for the chat's /fatura.
 */
export class GetCardStatementsUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly transactionRepository: TransactionRepository,
  ) {}

  async execute(userId: string, now = new Date()): Promise<CardStatement[]> {
    const [{ balances }, recent] = await Promise.all([
      loadCurrentBalances(
        this.accountRepository,
        this.transactionRepository,
        userId,
        now,
      ),
      // The open statement started at the last closing day, a month ago at most.
      this.transactionRepository.findByUserId(userId, {
        from: new Date(now.getFullYear(), now.getMonth() - 2, 1),
        to: now,
        pageSize: 10_000,
      }),
    ]);
    return calculateCardStatements(balances, recent, now);
  }
}
