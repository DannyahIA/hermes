import type { BudgetProgress } from '@/modules/budgets/application/get-budget-progress.use-case';

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

/** Spending this many points ahead of the calendar still counts as on pace. */
const PACE_TOLERANCE = 0.1;

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Whole days, so "today" counts as gone by: on 17 October a monthly budget
 * is 17/31 through.
 */
function elapsedShareOf(start: Date, end: Date, today: Date): number {
  const first = startOfDay(start).getTime();
  const days = Math.round((startOfDay(end).getTime() - first) / DAY) + 1;
  const gone = Math.round((startOfDay(today).getTime() - first) / DAY) + 1;
  return Math.min(1, Math.max(0, gone / days));
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
    .filter(({ budget }) => budget.period.contains(today))
    .map(({ budget, spent }) => {
      const spentShare = spent / budget.amount;
      const elapsedShare = elapsedShareOf(
        budget.periodStart,
        budget.periodEnd,
        today,
      );
      const status: BudgetPaceStatus =
        spentShare > 1
          ? 'over'
          : spentShare > elapsedShare + PACE_TOLERANCE
            ? 'ahead'
            : 'on-pace';

      return {
        budgetId: budget.id,
        categoryId: budget.categoryId,
        spent,
        amount: budget.amount,
        currency: budget.currency,
        spentShare,
        elapsedShare,
        status,
        periodStart: budget.periodStart,
        periodEnd: budget.periodEnd,
      };
    })
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        b.spentShare - a.spentShare,
    );
}
