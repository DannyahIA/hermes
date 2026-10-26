import { and, eq, inArray } from 'drizzle-orm';

import type { BudgetAlertLog } from '@/core/contracts/budget-alert-log';
import type { Executor } from '@/infra/database/client';
import { db } from '@/infra/database/client';
import { budgetAlerts } from '@/infra/database/schema';
import type { BudgetAlertStage } from '@/modules/budgets/domain/budget-alerts';

export class DrizzleBudgetAlertLogRepository implements BudgetAlertLog {
  constructor(private readonly executor: Executor = db) {}

  async warned(
    budgetId: string,
    periodStart: Date,
  ): Promise<Set<BudgetAlertStage>> {
    const rows = await this.executor
      .select({ stage: budgetAlerts.stage })
      .from(budgetAlerts)
      .where(
        and(
          eq(budgetAlerts.budgetId, budgetId),
          eq(budgetAlerts.periodStart, periodStart),
        ),
      );

    return new Set(rows.map((row) => row.stage as BudgetAlertStage));
  }

  async claim(
    budgetId: string,
    periodStart: Date,
    stages: BudgetAlertStage[],
  ): Promise<BudgetAlertStage[]> {
    if (stages.length === 0) return [];

    // The primary key decides: a stage another call inserted first is skipped
    // and not returned, so only one of two racing calls gets it.
    const inserted = await this.executor
      .insert(budgetAlerts)
      .values(stages.map((stage) => ({ budgetId, periodStart, stage })))
      .onConflictDoNothing()
      .returning({ stage: budgetAlerts.stage });

    return inserted.map((row) => row.stage as BudgetAlertStage);
  }

  async release(
    budgetId: string,
    periodStart: Date,
    stages: BudgetAlertStage[],
  ): Promise<void> {
    if (stages.length === 0) return;

    await this.executor
      .delete(budgetAlerts)
      .where(
        and(
          eq(budgetAlerts.budgetId, budgetId),
          eq(budgetAlerts.periodStart, periodStart),
          inArray(budgetAlerts.stage, stages),
        ),
      );
  }
}
