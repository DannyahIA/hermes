import type { AccountRepository } from '@/core/contracts/account-repository';
import type { BudgetRepository } from '@/core/contracts/budget-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import type { Account } from '@/core/entities/account';
import type { Transaction } from '@/core/entities/transaction';
import { computeCurrentBalance } from '@/core/value-objects/current-balance';
import type { AccountWithBalances } from '@/modules/accounts/application/get-accounts.use-case';
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
  accountBalances: AccountWithBalances[];
  /** Every not-yet-occurred transaction across all accounts — already
   * fetched to compute `accountBalances`, exposed here too so the UI can
   * list upcoming commitments (e.g. remaining installments) without a
   * second query. */
  futureTransactions: Transaction[];
  monthIncome: number;
  monthExpense: number;
  recentTransactions: Transaction[];
  cashFlow: MonthlyCashFlow[];
  budgets: BudgetProgress[];
}

const CASH_FLOW_MONTHS = 6;

function startOfTomorrow(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);
  return date;
}

/**
 * Answers, in one call, the questions ui-ux.md requires the dashboard to
 * answer immediately: "Quanto tenho?" (netWorth — computed from current
 * account balances, per domain.md, never stored), "Quanto gastei?"/"Quanto
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

    const [
      accounts,
      transactionsInRange,
      futureTransactions,
      allRecent,
      budgetProgress,
    ] = await Promise.all([
      this.accountRepository.findByUserId(userId),
      this.transactionRepository.findByUserId(userId, {
        from: rangeStart,
        to: now,
        pageSize: 1000,
      }),
      this.transactionRepository.findByUserId(userId, {
        from: startOfTomorrow(),
        pageSize: 10_000,
      }),
      this.transactionRepository.findByUserId(userId, { pageSize: 5 }),
      new GetBudgetProgressUseCase(
        this.budgetRepository,
        this.transactionRepository,
      ).execute(userId),
    ]);

    const futureByAccountId = new Map<string, typeof futureTransactions>();
    for (const transaction of futureTransactions) {
      const list = futureByAccountId.get(transaction.accountId) ?? [];
      list.push(transaction);
      futureByAccountId.set(transaction.accountId, list);
    }

    const accountBalances: AccountWithBalances[] = accounts.map((account) => {
      const future = futureByAccountId.get(account.id) ?? [];
      return {
        account,
        projectedBalance: account.balance,
        currentBalance: computeCurrentBalance(account.balance, future, account),
      };
    });

    const netWorth = accountBalances
      .filter(({ account }) => !account.hidden)
      .reduce((sum, { currentBalance }) => sum + currentBalance, 0);

    const cashFlow = buildMonthlyCashFlow(rangeStart, now, transactionsInRange);

    const monthTransactions = transactionsInRange.filter(
      (t) => t.occurredAt >= monthStart,
    );
    const monthIncome = sumByType(monthTransactions, 'income');
    const monthExpense = sumByType(monthTransactions, 'expense');

    return {
      netWorth,
      accounts,
      accountBalances,
      futureTransactions,
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
