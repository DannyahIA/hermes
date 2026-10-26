import type { AccountRepository } from '@/core/contracts/account-repository';
import type { BudgetRepository } from '@/core/contracts/budget-repository';
import type { CategoryRepository } from '@/core/contracts/category-repository';
import type { RecurringTransactionRepository } from '@/core/contracts/recurring-transaction-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
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
  type AccountSeries,
  calculateAccountSeries,
} from './metrics/calculate-account-series';
import {
  calculateCategoryComparison,
  type CategoryComparison,
} from './metrics/calculate-category-comparison';
import {
  calculateCategorySpending,
  type CategorySpending,
} from './metrics/calculate-category-spending';
import {
  calculateNetWorthByMonth,
  netWorthFetchRange,
  type NetWorthPoint,
} from './metrics/calculate-net-worth-by-month';
import type { PeriodComparison } from './metrics/calculate-period-comparison';
import {
  calculateRecurringExpenseShare,
  type RecurringExpenseShare,
} from './metrics/calculate-recurring-expense-share';
import { calculateSameMonthLastYear } from './metrics/calculate-same-month-last-year';
import {
  calculateTrendStats,
  type CategoryTrendStats,
} from './metrics/calculate-trend-stats';
import { calculateYearOverYear } from './metrics/calculate-year-over-year';

export interface ReportPeriod {
  from: Date;
  to: Date;
}

export interface FinancialReport {
  totalIncome: number;
  totalExpense: number;
  cashFlowByMonth: MonthlyCashFlow[];
  spendingByCategory: CategorySpending[];
  netWorthByMonth: NetWorthPoint[];
  budgetsOverview: BudgetProgress[];
  categoryComparison: CategoryComparison[];
  recurringExpenseShare: RecurringExpenseShare;
  accountSeries: AccountSeries[];
  /** Anchored to "now", not the selected period — see spec §3.5. */
  yearOverYear: PeriodComparison;
  /** Anchored to "now", not the selected period — see spec §3.5. */
  sameMonthLastYear: PeriodComparison;
  trendStats: CategoryTrendStats[];
}

/**
 * A read-only aggregation over existing tables — answers "para onde foi meu
 * dinheiro?" and "como minhas finanças evoluíram nesse período?" for an
 * arbitrary date range. Nothing here is stored; everything is derived at
 * read time from transactions/accounts/budgets, per domain.md.
 *
 * This class only orchestrates: it fetches each dataset once, then delegates
 * every computation to a pure function in `./metrics/`, so each metric stays
 * independently testable and reusable (see
 * docs/superpowers/specs/2026-10-16-financial-reports-center-design.md).
 */
export class GetFinancialReportUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly budgetRepository: BudgetRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly recurringTransactionRepository: RecurringTransactionRepository,
  ) {}

  /**
   * `now` is injectable so the "anchored to today" metrics (year-over-year,
   * same-month-last-year, and the net-worth/account walk-backs) all share one
   * instant instead of each calling `new Date()` microseconds apart — and so
   * tests can pin it rather than depending on the wall clock.
   */
  async execute(
    userId: string,
    period: ReportPeriod,
    now: Date = new Date(),
  ): Promise<FinancialReport> {
    const periodDurationMs = period.to.getTime() - period.from.getTime();
    const previousPeriod: ReportPeriod = {
      from: new Date(period.from.getTime() - periodDurationMs - 1),
      to: new Date(period.from.getTime() - 1),
    };
    const netWorthRange = netWorthFetchRange(period);
    const yoyWindowStart = new Date(now.getFullYear() - 1, 0, 1);

    const [
      accounts,
      transactionsInPeriod,
      previousPeriodTransactions,
      categories,
      budgetsOverview,
      recurringRules,
      netWorthTransactions,
      yoyTransactions,
    ] = await Promise.all([
      this.accountRepository.findByUserId(userId),
      this.transactionRepository.findByUserId(userId, {
        from: period.from,
        to: period.to,
        pageSize: 10000,
      }),
      this.transactionRepository.findByUserId(userId, {
        from: previousPeriod.from,
        to: previousPeriod.to,
        pageSize: 10000,
      }),
      this.categoryRepository.findByUserId(userId),
      new GetBudgetProgressUseCase(
        this.budgetRepository,
        this.transactionRepository,
      ).execute(userId, period.to),
      this.recurringTransactionRepository.findByUserId(userId),
      // No upper bound: net worth is walked back from today's balance (see
      // netWorthFetchRange).
      this.transactionRepository.findByUserId(userId, {
        from: netWorthRange.from,
        pageSize: 10000,
      }),
      // Anchored to "now", independent of the selected period: covers both
      // this year-to-date and the equivalent window a year back, which is
      // what yearOverYear and sameMonthLastYear each slice up themselves.
      this.transactionRepository.findByUserId(userId, {
        from: yoyWindowStart,
        to: now,
        pageSize: 10000,
      }),
    ]);

    const totalIncome = sumByType(transactionsInPeriod, 'income');
    const totalExpense = sumByType(transactionsInPeriod, 'expense');

    const cashFlowByMonth = buildMonthlyCashFlow(
      period.from,
      period.to,
      transactionsInPeriod,
    );

    const spendingByCategory = calculateCategorySpending(
      transactionsInPeriod,
      categories,
    );

    const netWorthByMonth = calculateNetWorthByMonth(
      accounts,
      netWorthTransactions,
      period,
      now,
    );

    const categoryComparison = calculateCategoryComparison(
      transactionsInPeriod,
      previousPeriodTransactions,
      categories,
    );

    const recurringExpenseShare = calculateRecurringExpenseShare(
      recurringRules,
      totalIncome,
      period,
    );

    const accountSeries = calculateAccountSeries(
      accounts,
      netWorthTransactions,
      period,
      now,
    );
    const yearOverYear = calculateYearOverYear(
      yoyTransactions,
      categories,
      now,
    );
    const sameMonthLastYear = calculateSameMonthLastYear(
      yoyTransactions,
      categories,
      now,
    );
    const trendStats = calculateTrendStats(
      transactionsInPeriod,
      categories,
      period,
    );

    return {
      totalIncome,
      totalExpense,
      cashFlowByMonth,
      spendingByCategory,
      netWorthByMonth,
      budgetsOverview,
      categoryComparison,
      recurringExpenseShare,
      accountSeries,
      yearOverYear,
      sameMonthLastYear,
      trendStats,
    };
  }
}
