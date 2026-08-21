import type { AccountRepository } from '@/core/contracts/account-repository';
import type { BudgetRepository } from '@/core/contracts/budget-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import type { Account } from '@/core/entities/account';
import type { Transaction } from '@/core/entities/transaction';
import {
  type BudgetProgress,
  GetBudgetProgressUseCase,
} from '@/modules/budgets/application/get-budget-progress.use-case';
import {
  buildMonthlyCashFlow,
  type MonthlyCashFlow,
} from '@/shared/lib/build-monthly-cash-flow';

export type { MonthlyCashFlow };

export interface DashboardSummary {
  netWorth: number;
  accounts: Account[];
  monthIncome: number;
  monthExpense: number;
  recentTransactions: Transaction[];
  cashFlow: MonthlyCashFlow[];
  budgets: BudgetProgress[];
}

const CASH_FLOW_MONTHS = 6;

/**
 * Answers, in one call, the questions ui-ux.md requires the dashboard to
 * answer immediately: "Quanto tenho?" (netWorth — computed from account
 * balances, per domain.md, never stored), "Quanto gastei?"/"Quanto
 * recebi?" (monthIncome/monthExpense), "Estou dentro do orçamento?"
 * (budgets), "Como evoluíram minhas finanças?" (cashFlow).
 */
export class GetDashboardSummaryUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly budgetRepository: BudgetRepository,
  ) {}

  async execute(userId: string): Promise<DashboardSummary> {
    const now = new Date();
    const rangeStart = new Date(
      now.getFullYear(),
      now.getMonth() - (CASH_FLOW_MONTHS - 1),
      1,
    );
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [accounts, transactionsInRange, allRecent, budgetProgress] =
      await Promise.all([
        this.accountRepository.findByUserId(userId),
        this.transactionRepository.findByUserId(userId, {
          from: rangeStart,
          to: now,
          pageSize: 1000,
        }),
        this.transactionRepository.findByUserId(userId, { pageSize: 5 }),
        new GetBudgetProgressUseCase(
          this.budgetRepository,
          this.transactionRepository,
        ).execute(userId),
      ]);

    const netWorth = accounts
      .filter((account) => !account.hidden)
      .reduce((sum, account) => sum + account.balance, 0);

    const cashFlow = buildMonthlyCashFlow(rangeStart, now, transactionsInRange);

    const monthTransactions = transactionsInRange.filter(
      (t) => t.occurredAt >= monthStart,
    );
    const monthIncome = sumByType(monthTransactions, 'income');
    const monthExpense = sumByType(monthTransactions, 'expense');

    return {
      netWorth,
      accounts,
      monthIncome,
      monthExpense,
      recentTransactions: allRecent,
      cashFlow,
      budgets: budgetProgress,
    };
  }
}

function sumByType(
  transactions: Transaction[],
  type: Transaction['type'],
): number {
  return transactions
    .filter((t) => t.type === type)
    .reduce((sum, t) => sum + t.amount, 0);
}
