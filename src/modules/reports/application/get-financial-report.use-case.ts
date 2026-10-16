import type { AccountRepository } from '@/core/contracts/account-repository';
import type { BudgetRepository } from '@/core/contracts/budget-repository';
import type { CategoryRepository } from '@/core/contracts/category-repository';
import type { RecurringTransactionRepository } from '@/core/contracts/recurring-transaction-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import type { RecurringTransaction } from '@/core/entities/recurring-transaction';
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
import {
  calculateRecurringExpenseShare,
  type RecurringExpenseShare,
} from './metrics/calculate-recurring-expense-share';

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

  async execute(
    userId: string,
    period: ReportPeriod,
  ): Promise<FinancialReport> {
    const periodDurationMs = period.to.getTime() - period.from.getTime();
    const previousPeriod: ReportPeriod = {
      from: new Date(period.from.getTime() - periodDurationMs - 1),
      to: new Date(period.from.getTime() - 1),
    };
    const netWorthRange = netWorthFetchRange(period);

    const [
      accounts,
      transactionsInPeriod,
      previousPeriodTransactions,
      categories,
      budgetsOverview,
      recurringRules,
      netWorthTransactions,
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
      ).execute(userId),
      this.recurringTransactionRepository.findByUserId(userId),
      this.transactionRepository.findByUserId(userId, {
        from: netWorthRange.from,
        to: netWorthRange.to,
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

    return {
      totalIncome,
      totalExpense,
      cashFlowByMonth,
      spendingByCategory,
      netWorthByMonth,
      budgetsOverview,
      categoryComparison,
      recurringExpenseShare,
    };
  }
}
