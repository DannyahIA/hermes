import type { RecurringTransaction } from '@/core/entities/recurring-transaction';

export interface RecurringExpenseShare {
  monthlyRecurringExpense: number;
  averageMonthlyIncome: number;
  percentage: number | null;
}

export function calculateRecurringExpenseShare(
  recurringRules: RecurringTransaction[],
  totalIncome: number,
  period: { from: Date; to: Date },
): RecurringExpenseShare {
  const monthlyRecurringExpense = recurringRules
    .filter((rule) => rule.active && rule.type === 'expense')
    .reduce((sum, rule) => sum + rule.amount, 0);

  const monthsInPeriod = Math.max(
    0.25,
    (period.to.getTime() - period.from.getTime()) / (30 * 24 * 60 * 60 * 1000),
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
