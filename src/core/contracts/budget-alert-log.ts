import type { BudgetAlertStage } from '@/modules/budgets/domain/budget-alerts';

/**
 * Which warning stages a budget has already told about, per period, so each
 * is told once and starts over when a new period begins.
 */
export interface BudgetAlertLog {
  /** The stages already told for the budget's period starting at `periodStart`. */
  warned(budgetId: string, periodStart: Date): Promise<Set<BudgetAlertStage>>;
  /**
   * Marks `stages` as told and returns the ones this call marked — a stage
   * another call got to first is left out, so of two calls racing for the
   * same stage only one wins it.
   */
  claim(
    budgetId: string,
    periodStart: Date,
    stages: BudgetAlertStage[],
  ): Promise<BudgetAlertStage[]>;
  /**
   * Forgets `stages`, so they can be told again: spending fell back below
   * them (a purchase undone, a limit raised).
   */
  release(
    budgetId: string,
    periodStart: Date,
    stages: BudgetAlertStage[],
  ): Promise<void>;
}
