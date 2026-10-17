import type { Transaction } from '@/core/entities/transaction';
import { sumByType } from '@/shared/lib/sum-by-type';

export interface MonthlyCashFlow {
  month: Date;
  income: number;
  expense: number;
}

/**
 * Buckets transactions into calendar months from `start` through `end`
 * (inclusive), summing income and expense separately. Shared by
 * `GetDashboardSummaryUseCase` and `GetFinancialReportUseCase` so the two
 * never drift apart on what "cash flow by month" means.
 *
 * `perAccount` is money in and out of a single account, where a card bill
 * payment is a real outflow. Everywhere else it is left out, since the card
 * purchases it pays for already count (see Transaction#isCardBillPayment).
 */
export function buildMonthlyCashFlow(
  start: Date,
  end: Date,
  transactions: Transaction[],
  { perAccount = false }: { perAccount?: boolean } = {},
): MonthlyCashFlow[] {
  const sum = (monthTransactions: Transaction[], type: 'income' | 'expense') =>
    perAccount
      ? monthTransactions
          .filter((t) => t.type === type)
          .reduce((total, t) => total + t.amount, 0)
      : sumByType(monthTransactions, type);

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
      income: sum(monthTransactions, 'income'),
      expense: sum(monthTransactions, 'expense'),
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}
