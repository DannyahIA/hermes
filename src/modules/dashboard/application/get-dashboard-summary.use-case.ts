import type { AccountRepository } from '@/core/contracts/account-repository';
import type { BudgetRepository } from '@/core/contracts/budget-repository';
import type { RecurringTransactionRepository } from '@/core/contracts/recurring-transaction-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import type { Account } from '@/core/entities/account';
import type { Transaction } from '@/core/entities/transaction';
import { computeCurrentBalance } from '@/core/value-objects/current-balance';
import { netWorthContribution } from '@/core/value-objects/net-worth';
import type { AccountWithBalances } from '@/modules/accounts/application/get-accounts.use-case';
import {
  type BudgetProgress,
  GetBudgetProgressUseCase,
} from '@/modules/budgets/application/get-budget-progress.use-case';
import {
  buildMonthlyCashFlow,
  type MonthlyCashFlow,
} from '@/shared/lib/build-monthly-cash-flow';
import { sumByType } from '@/shared/lib/sum-by-type';

import {
  type AvailableToSpend,
  calculateAvailableToSpend,
} from './metrics/calculate-available-to-spend';
import {
  calculateMonthToDate,
  type MonthToDate,
} from './metrics/calculate-month-to-date';

export type { MonthlyCashFlow };

export interface DashboardSummary {
  netWorth: number;
  /** Net worth once every known future commitment (installments) has landed. */
  projectedNetWorth: number;
  /** What's owed on visible credit cards today. */
  owedOnCards: number;
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
  /** Null without a checking account to spend from. */
  availableToSpend: AvailableToSpend | null;
  monthToDate: MonthToDate;
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
 * account balances, per domain.md, never stored, with card debt counted
 * against it), "Quanto gastei?"/"Quanto
 * recebi?" (monthIncome/monthExpense), "Estou dentro do orçamento?"
 * (budgets), "Como evoluíram minhas finanças?" (cashFlow).
 */
export class GetDashboardSummaryUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly budgetRepository: BudgetRepository,
    private readonly recurringTransactionRepository: RecurringTransactionRepository,
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
      recurringRules,
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
      this.recurringTransactionRepository.findByUserId(userId),
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

    const visibleBalances = accountBalances.filter(
      ({ account }) => !account.hidden,
    );
    const netWorth = visibleBalances.reduce(
      (sum, { account, currentBalance }) =>
        sum + netWorthContribution(account, currentBalance),
      0,
    );
    const owedOnCards = visibleBalances
      .filter(({ account }) => account.type === 'credit')
      .reduce(
        (sum, { currentBalance }) => sum + Math.max(0, currentBalance),
        0,
      );
    const projectedNetWorth = visibleBalances.reduce(
      (sum, { account, projectedBalance }) =>
        sum + netWorthContribution(account, projectedBalance),
      0,
    );

    const cashFlow = buildMonthlyCashFlow(rangeStart, now, transactionsInRange);

    const monthTransactions = transactionsInRange.filter(
      (t) => t.occurredAt >= monthStart,
    );
    const monthIncome = sumByType(monthTransactions, 'income');
    const monthExpense = sumByType(monthTransactions, 'expense');

    return {
      netWorth,
      projectedNetWorth,
      owedOnCards,
      accounts,
      accountBalances,
      futureTransactions,
      monthIncome,
      monthExpense,
      recentTransactions: allRecent,
      cashFlow,
      budgets: budgetProgress,
      availableToSpend: calculateAvailableToSpend({
        balances: accountBalances,
        recurringRules,
        futureTransactions,
        today: now,
      }),
      monthToDate: calculateMonthToDate(transactionsInRange, now),
    };
  }
}
