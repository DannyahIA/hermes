import { describe, expect, it } from 'vitest';

import { RecurringTransaction } from '@/core/entities/recurring-transaction';

import { calculateRecurringExpenseShare } from './calculate-recurring-expense-share';

function rule(
  overrides: Partial<{
    type: 'income' | 'expense';
    amount: number;
    active: boolean;
  }> = {},
) {
  return new RecurringTransaction({
    id: 'r1',
    userId: 'u1',
    accountId: 'acc-1',
    description: 'Regra',
    amount: overrides.amount ?? 100,
    type: overrides.type ?? 'expense',
    dayRuleKind: 'fixed_day',
    dayRuleDay: 5,
    startDate: new Date('2026-01-01'),
    active: overrides.active ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('calculateRecurringExpenseShare', () => {
  it('sums only active recurring expense rules and divides by average monthly income', () => {
    const rules = [
      rule({ amount: 300, active: true }),
      rule({ amount: 200, active: true }),
      rule({ amount: 999, active: false }),
      rule({ type: 'income', amount: 500, active: true }),
    ];
    const result = calculateRecurringExpenseShare(rules, 2000, {
      from: new Date('2026-07-01T00:00:00'),
      to: new Date('2026-07-31T23:59:59'),
    });
    expect(result.monthlyRecurringExpense).toBe(500);
    expect(result.averageMonthlyIncome).toBeCloseTo(1935.48, 2);
    expect(result.percentage).toBeCloseTo(25.83, 2);
  });

  it('returns percentage: null when there is no income in the period', () => {
    const result = calculateRecurringExpenseShare([rule({ amount: 100 })], 0, {
      from: new Date('2026-07-01T00:00:00'),
      to: new Date('2026-07-31T23:59:59'),
    });
    expect(result.percentage).toBeNull();
  });
});
