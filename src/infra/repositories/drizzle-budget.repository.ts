import { eq, inArray } from 'drizzle-orm';

import type { BudgetRepository } from '@/core/contracts/budget-repository';
import {
  Budget,
  type BudgetKind,
  type BudgetLimit,
} from '@/core/entities/budget';
import type { Executor } from '@/infra/database/client';
import { db } from '@/infra/database/client';
import { budgetLimits, budgets } from '@/infra/database/schema';

type BudgetRow = typeof budgets.$inferSelect;
type LimitRow = typeof budgetLimits.$inferSelect;

function toDomain(row: BudgetRow, limits: LimitRow[]): Budget {
  return new Budget({
    id: row.id,
    userId: row.userId,
    categoryId: row.categoryId,
    amount: Number(row.amount),
    currency: row.currency,
    kind: row.kind as BudgetKind,
    limits: limits
      .map((l) => ({ startsOn: l.startsOn, amount: Number(l.amount) }))
      .sort((a, b) => a.startsOn.getTime() - b.startsOn.getTime()),
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export class DrizzleBudgetRepository implements BudgetRepository {
  constructor(private readonly executor: Executor = db) {}

  async findById(id: string): Promise<Budget | null> {
    const [row] = await this.executor
      .select()
      .from(budgets)
      .where(eq(budgets.id, id))
      .limit(1);
    if (!row) return null;

    const limits = await this.executor
      .select()
      .from(budgetLimits)
      .where(eq(budgetLimits.budgetId, id));

    return toDomain(row, limits);
  }

  async findByUserId(userId: string): Promise<Budget[]> {
    const rows = await this.executor
      .select()
      .from(budgets)
      .where(eq(budgets.userId, userId));
    if (rows.length === 0) return [];

    const limits = await this.executor
      .select()
      .from(budgetLimits)
      .where(
        inArray(
          budgetLimits.budgetId,
          rows.map((row) => row.id),
        ),
      );

    return rows.map((row) =>
      toDomain(
        row,
        limits.filter((l) => l.budgetId === row.id),
      ),
    );
  }

  async save(budget: Budget): Promise<void> {
    const values = {
      id: budget.id,
      userId: budget.userId,
      categoryId: budget.categoryId,
      amount: budget.amount.toFixed(2),
      currency: budget.currency,
      kind: budget.kind,
      periodStart: budget.periodStart,
      periodEnd: budget.props.periodEnd,
      updatedAt: budget.props.updatedAt,
    };

    // Atomic: a failed limit insert must not leave the history deleted. On an
    // executor that is already a transaction, Drizzle uses a savepoint.
    await this.executor.transaction(async (tx) => {
      await tx
        .insert(budgets)
        .values({ ...values, createdAt: budget.props.createdAt })
        .onConflictDoUpdate({ target: budgets.id, set: values });

      await tx.delete(budgetLimits).where(eq(budgetLimits.budgetId, budget.id));
      const limits: BudgetLimit[] = budget.props.limits;
      if (limits.length > 0) {
        await tx.insert(budgetLimits).values(
          limits.map((limit) => ({
            budgetId: budget.id,
            startsOn: limit.startsOn,
            amount: limit.amount.toFixed(2),
          })),
        );
      }
    });
  }

  async delete(id: string): Promise<void> {
    await this.executor.delete(budgets).where(eq(budgets.id, id));
  }
}
