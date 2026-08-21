import type { AccountRepository } from '@/core/contracts/account-repository';
import type { BudgetRepository } from '@/core/contracts/budget-repository';
import type { CategoryRepository } from '@/core/contracts/category-repository';
import type { RecurringTransactionRepository } from '@/core/contracts/recurring-transaction-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import type { Account } from '@/core/entities/account';
import type { RecurringTransaction } from '@/core/entities/recurring-transaction';
import type { Transaction } from '@/core/entities/transaction';
import {
  type BudgetProgress,
  GetBudgetProgressUseCase,
} from '@/modules/budgets/application/get-budget-progress.use-case';
import {
  buildMonthlyCashFlow,
  type MonthlyCashFlow,
} from '@/shared/lib/build-monthly-cash-flow';

export interface SpendingReportPeriod {
  from: Date;
  to: Date;
}

export interface CategorySpending {
  categoryId: string;
  categoryName: string;
  total: number;
}

export interface NetWorthPoint {
  month: Date;
  netWorth: number;
}

export interface CategoryComparison {
  categoryId: string;
  categoryName: string;
  currentTotal: number;
  previousTotal: number;
  deltaPercent: number | null;
}

export interface RecurringExpenseShare {
  monthlyRecurringExpense: number;
  averageMonthlyIncome: number;
  percentage: number | null;
}

export interface SpendingReport {
  totalIncome: number;
  totalExpense: number;
  cashFlowByMonth: MonthlyCashFlow[];
  spendingByCategory: CategorySpending[];
  netWorthByMonth: NetWorthPoint[];
  budgetsOverview: BudgetProgress[];
  categoryComparison: CategoryComparison[];
  recurringExpenseShare: RecurringExpenseShare;
}

const UNCATEGORIZED_KEY = 'uncategorized';

/**
 * A read-only aggregation over existing tables — answers "para onde foi meu
 * dinheiro?" and "como minhas finanças evoluíram nesse período?" for an
 * arbitrary date range. Nothing here is stored; everything is derived at
 * read time from transactions/accounts/budgets, per domain.md.
 */
export class GetSpendingReportUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly budgetRepository: BudgetRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly recurringTransactionRepository: RecurringTransactionRepository,
  ) {}

  async execute(
    userId: string,
    period: SpendingReportPeriod,
  ): Promise<SpendingReport> {
    const periodDurationMs = period.to.getTime() - period.from.getTime();
    const previousPeriod: SpendingReportPeriod = {
      from: new Date(period.from.getTime() - periodDurationMs - 1),
      to: new Date(period.from.getTime() - 1),
    };

    const [
      accounts,
      transactionsInPeriod,
      previousPeriodTransactions,
      categories,
      budgetsOverview,
      recurringRules,
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
    ]);

    const totalIncome = sumByType(transactionsInPeriod, 'income');
    const totalExpense = sumByType(transactionsInPeriod, 'expense');

    const cashFlowByMonth = buildMonthlyCashFlow(
      period.from,
      period.to,
      transactionsInPeriod,
    );

    const spendingByCategory = this.buildSpendingByCategory(
      transactionsInPeriod,
      categories,
    );

    const netWorthByMonth = await this.buildNetWorthByMonth(
      userId,
      accounts,
      period,
    );

    const categoryComparison = this.buildCategoryComparison(
      transactionsInPeriod,
      previousPeriodTransactions,
      categories,
    );

    const recurringExpenseShare = this.buildRecurringExpenseShare(
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

  private buildSpendingByCategory(
    transactions: Transaction[],
    categories: Array<{ id: string; name: string }>,
  ): CategorySpending[] {
    const categoriesById = new Map(
      categories.map((category) => [category.id, category]),
    );
    const totalsByCategory = new Map<string, number>();

    for (const transaction of transactions) {
      if (transaction.type !== 'expense') continue;

      const key = transaction.categoryId ?? UNCATEGORIZED_KEY;
      totalsByCategory.set(
        key,
        (totalsByCategory.get(key) ?? 0) + transaction.amount,
      );
    }

    return [...totalsByCategory.entries()]
      .map(([categoryId, total]) => ({
        categoryId,
        categoryName:
          categoryId === UNCATEGORIZED_KEY
            ? 'Sem categoria'
            : (categoriesById.get(categoryId)?.name ?? 'Categoria removida'),
        total,
      }))
      .sort((a, b) => b.total - a.total);
  }

  private buildCategoryComparison(
    currentTransactions: Transaction[],
    previousTransactions: Transaction[],
    categories: Array<{ id: string; name: string }>,
  ): CategoryComparison[] {
    const currentByCategory = this.sumExpenseByCategory(currentTransactions);
    const previousByCategory = this.sumExpenseByCategory(previousTransactions);
    const categoriesById = new Map(
      categories.map((category) => [category.id, category]),
    );

    const allCategoryIds = new Set([
      ...currentByCategory.keys(),
      ...previousByCategory.keys(),
    ]);

    return [...allCategoryIds]
      .map((categoryId) => {
        const currentTotal = currentByCategory.get(categoryId) ?? 0;
        const previousTotal = previousByCategory.get(categoryId) ?? 0;
        return {
          categoryId,
          categoryName:
            categoryId === UNCATEGORIZED_KEY
              ? 'Sem categoria'
              : (categoriesById.get(categoryId)?.name ?? 'Categoria removida'),
          currentTotal,
          previousTotal,
          deltaPercent:
            previousTotal === 0
              ? null
              : ((currentTotal - previousTotal) / previousTotal) * 100,
        };
      })
      .sort(
        (a, b) =>
          b.currentTotal - b.previousTotal - (a.currentTotal - a.previousTotal),
      );
  }

  private sumExpenseByCategory(
    transactions: Transaction[],
  ): Map<string, number> {
    const totals = new Map<string, number>();
    for (const transaction of transactions) {
      if (transaction.type !== 'expense') continue;
      const key = transaction.categoryId ?? UNCATEGORIZED_KEY;
      totals.set(key, (totals.get(key) ?? 0) + transaction.amount);
    }
    return totals;
  }

  private buildRecurringExpenseShare(
    recurringRules: RecurringTransaction[],
    totalIncome: number,
    period: SpendingReportPeriod,
  ): RecurringExpenseShare {
    const monthlyRecurringExpense = recurringRules
      .filter((rule) => rule.active && rule.type === 'expense')
      .reduce((sum, rule) => sum + rule.amount, 0);

    const monthsInPeriod = Math.max(
      1,
      Math.round(
        (period.to.getTime() - period.from.getTime()) /
          (30 * 24 * 60 * 60 * 1000),
      ),
    );
    const averageMonthlyIncome = totalIncome / monthsInPeriod;

    return {
      monthlyRecurringExpense,
      averageMonthlyIncome,
      percentage:
        averageMonthlyIncome === 0
          ? null
          : (monthlyRecurringExpense / averageMonthlyIncome) * 100,
    };
  }

  /**
   * Net worth is never stored (domain.md: "o patrimônio é sempre calculado,
   * nunca armazenado") — so a *history* of it doesn't exist either. This
   * reconstructs one by starting at each visible account's current balance
   * and walking backward one calendar month at a time, subtracting that
   * month's net income/expense effect on the account (transfers move money
   * between the user's own accounts and net to zero across all of them, so
   * they're excluded). Note this can't see balance the account started with
   * before its first transaction — a month older than that will still show
   * its current balance, since there's no stored opening-balance date to
   * anchor against.
   */
  private async buildNetWorthByMonth(
    userId: string,
    accounts: Account[],
    period: SpendingReportPeriod,
  ): Promise<NetWorthPoint[]> {
    const now = new Date();
    const visibleAccounts = accounts.filter((account) => !account.hidden);
    const accountsById = new Map(
      visibleAccounts.map((account) => [account.id, account]),
    );

    const periodEnd = period.to < now ? period.to : now;
    const rangeStart = new Date(
      period.from.getFullYear(),
      period.from.getMonth(),
      1,
    );

    const transactions = await this.transactionRepository.findByUserId(userId, {
      from: rangeStart,
      to: periodEnd,
      pageSize: 10000,
    });

    let runningNetWorth = visibleAccounts.reduce(
      (sum, account) => sum + account.balance,
      0,
    );

    const points: NetWorthPoint[] = [];
    const cursor = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1);

    while (cursor >= rangeStart) {
      points.unshift({ month: new Date(cursor), netWorth: runningNetWorth });

      const monthEffect = transactions
        .filter(isIncomeOrExpense)
        .filter(
          (t) =>
            t.occurredAt.getFullYear() === cursor.getFullYear() &&
            t.occurredAt.getMonth() === cursor.getMonth() &&
            accountsById.has(t.accountId),
        )
        .reduce((sum, t) => {
          const account = accountsById.get(t.accountId);
          return account ? sum + account.deltaFor(t.type, t.amount) : sum;
        }, 0);

      runningNetWorth -= monthEffect;
      cursor.setMonth(cursor.getMonth() - 1);
    }

    return points;
  }
}

function isIncomeOrExpense(
  transaction: Transaction,
): transaction is Transaction & { type: 'income' | 'expense' } {
  return transaction.type === 'income' || transaction.type === 'expense';
}

function sumByType(
  transactions: Transaction[],
  type: Transaction['type'],
): number {
  return transactions
    .filter((t) => t.type === type)
    .reduce((sum, t) => sum + t.amount, 0);
}
