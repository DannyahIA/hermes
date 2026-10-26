import type { BudgetProgress } from '@/modules/budgets/application/get-budget-progress.use-case';
import {
  elapsedShareOf,
  isAheadOfPace,
} from '@/modules/budgets/domain/budget-pace';
import { limitState } from '@/modules/budgets/domain/limit-state';

export type BudgetPaceStatus = 'on-pace' | 'ahead' | 'over';

export interface BudgetPace {
  budgetId: string;
  categoryId: string;
  spent: number;
  amount: number;
  currency: string;
  /** Spent over the limit — above 1 once it's blown. */
  spentShare: number;
  /** How much of the budget's period has gone by today, from 0 to 1. */
  elapsedShare: number;
  status: BudgetPaceStatus;
  periodStart: Date;
  periodEnd: Date;
}

const STATUS_ORDER: Record<BudgetPaceStatus, number> = {
  over: 0,
  ahead: 1,
  'on-pace': 2,
};

/**
 * Each budget running today, against how much of its period has gone by
 * (spec 2026-10-17-inicio-hub-design.md §4.4): on pace while spending is
 * no more than 10 points ahead of the calendar, ahead of pace above that,
 * over once past the limit. Blown budgets lead, then the ones ahead of pace,
 * then by share spent.
 */
export function calculateBudgetPace(
  progress: BudgetProgress[],
  today: Date,
): BudgetPace[] {
  return progress
    .filter(({ running }) => running)
    .map(({ budget, period, amount, spent }) => {
      const spentShare = spent / amount;
      const elapsedShare = elapsedShareOf(period, today);
      const status: BudgetPaceStatus =
        limitState(spent, amount) === 'over'
          ? 'over'
          : isAheadOfPace(spentShare, elapsedShare)
            ? 'ahead'
            : 'on-pace';

      return {
        budgetId: budget.id,
        categoryId: budget.categoryId,
        spent,
        amount,
        currency: budget.currency,
        spentShare,
        elapsedShare,
        status,
        periodStart: period.start,
        periodEnd: period.end,
      };
    })
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        b.spentShare - a.spentShare,
    );
}
