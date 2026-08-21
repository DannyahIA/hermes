import type { Transaction } from '@/core/entities/transaction';

export interface MonthlyCashFlow {
  month: Date;
  income: number;
  expense: number;
}

/**
 * Buckets transactions into calendar months from `start` through `end`
 * (inclusive), summing income and expense separately. Shared by
 * `GetDashboardSummaryUseCase` and `GetSpendingReportUseCase` so the two
 * never drift apart on what "cash flow by month" means.
 */
export function buildMonthlyCashFlow(
  start: Date,
  end: Date,
  transactions: Transaction[],
): MonthlyCashFlow[] {
  const months: MonthlyCashFlow[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);

  while (cursor <= end) {
    const monthTransactions = transactions.filter(
      (t) =>
        t.occurredAt.getFullYear() === cursor.getFullYear() &&
        t.occurredAt.getMonth() === cursor.getMonth(),
    );

    months.push({
      month: new Date(cursor),
      income: sumByType(monthTransactions, 'income'),
      expense: sumByType(monthTransactions, 'expense'),
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

function sumByType(
  transactions: Transaction[],
  type: Transaction['type'],
): number {
  return transactions
    .filter((t) => t.type === type)
    .reduce((sum, t) => sum + t.amount, 0);
}
