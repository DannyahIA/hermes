import { eq } from 'drizzle-orm';

import type { BudgetRepository } from '@/core/contracts/budget-repository';
import { Budget } from '@/core/entities/budget';
import type { Executor } from '@/infra/database/client';
import { db } from '@/infra/database/client';
import { budgets } from '@/infra/database/schema';

type BudgetRow = typeof budgets.$inferSelect;

function toDomain(row: BudgetRow): Budget {
  return new Budget({
    id: row.id,
    userId: row.userId,
    categoryId: row.categoryId,
    amount: Number(row.amount),
    currency: row.currency,
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

    return row ? toDomain(row) : null;
  }

  async findByUserId(userId: string): Promise<Budget[]> {
    const rows = await this.executor
      .select()
      .from(budgets)
      .where(eq(budgets.userId, userId));

    return rows.map(toDomain);
  }

  async save(budget: Budget): Promise<void> {
    const values = {
      id: budget.id,
      userId: budget.userId,
      categoryId: budget.categoryId,
      amount: budget.amount.toFixed(2),
      currency: budget.currency,
      periodStart: budget.periodStart,
      periodEnd: budget.periodEnd,
      updatedAt: budget.props.updatedAt,
    };

    await this.executor
      .insert(budgets)
      .values({ ...values, createdAt: budget.props.createdAt })
      .onConflictDoUpdate({ target: budgets.id, set: values });
  }

  async delete(id: string): Promise<void> {
    await this.executor.delete(budgets).where(eq(budgets.id, id));
  }
}
