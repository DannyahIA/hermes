import type { BudgetAlertLog } from '@/core/contracts/budget-alert-log';
import type { BudgetAlertStage } from '@/modules/budgets/domain/budget-alerts';

function keyOf(
  budgetId: string,
  periodStart: Date,
  stage: BudgetAlertStage,
): string {
  return `${budgetId}|${periodStart.getTime()}|${stage}`;
}

export class FakeBudgetAlertLog implements BudgetAlertLog {
  private readonly told = new Set<string>();

  async warned(
    budgetId: string,
    periodStart: Date,
  ): Promise<Set<BudgetAlertStage>> {
    const prefix = keyOf(budgetId, periodStart, '' as BudgetAlertStage);
    return new Set(
      [...this.told]
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length) as BudgetAlertStage),
    );
  }

  /**
   * Synchronous inside, so two calls started together cannot both insert the
   * same key — like the database's primary key.
   */
  async claim(
    budgetId: string,
    periodStart: Date,
    stages: BudgetAlertStage[],
  ): Promise<BudgetAlertStage[]> {
    const claimed: BudgetAlertStage[] = [];
    for (const stage of stages) {
      const key = keyOf(budgetId, periodStart, stage);
      if (this.told.has(key)) continue;
      this.told.add(key);
      claimed.push(stage);
    }
    return claimed;
  }

  async release(
    budgetId: string,
    periodStart: Date,
    stages: BudgetAlertStage[],
  ): Promise<void> {
    for (const stage of stages) {
      this.told.delete(keyOf(budgetId, periodStart, stage));
    }
  }
}
