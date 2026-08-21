import { and, eq, lte } from 'drizzle-orm';

import type { RecurringTransactionRepository } from '@/core/contracts/recurring-transaction-repository';
import {
  type DayRuleKind,
  RecurringTransaction,
  type RecurringTransactionKind,
} from '@/core/entities/recurring-transaction';
import type { Executor } from '@/infra/database/client';
import { db } from '@/infra/database/client';
import { recurringTransactions } from '@/infra/database/schema';

type RecurringTransactionRow = typeof recurringTransactions.$inferSelect;

function toDomain(row: RecurringTransactionRow): RecurringTransaction {
  return new RecurringTransaction({
    id: row.id,
    userId: row.userId,
    accountId: row.accountId,
    categoryId: row.categoryId ?? undefined,
    description: row.description,
    amount: Number(row.amount),
    type: row.type as RecurringTransactionKind,
    dayRuleKind: row.dayRuleKind as DayRuleKind,
    dayRuleDay: row.dayRuleDay ?? undefined,
    startDate: row.startDate,
    endDate: row.endDate ?? undefined,
    lastGeneratedThrough: row.lastGeneratedThrough ?? undefined,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export class DrizzleRecurringTransactionRepository implements RecurringTransactionRepository {
  constructor(private readonly executor: Executor = db) {}

  async findById(id: string): Promise<RecurringTransaction | null> {
    const [row] = await this.executor
      .select()
      .from(recurringTransactions)
      .where(eq(recurringTransactions.id, id))
      .limit(1);

    return row ? toDomain(row) : null;
  }

  async findByUserId(userId: string): Promise<RecurringTransaction[]> {
    const rows = await this.executor
      .select()
      .from(recurringTransactions)
      .where(eq(recurringTransactions.userId, userId));

    return rows.map(toDomain);
  }

  async findDueForGeneration(
    userId: string,
    asOf: Date,
  ): Promise<RecurringTransaction[]> {
    // A cheap pre-filter (active + already started) — the exact occurrence
    // dates, and whether anything is actually missing, are decided by
    // occurrencesToGenerate() in GenerateDueOccurrencesUseCase.
    const rows = await this.executor
      .select()
      .from(recurringTransactions)
      .where(
        and(
          eq(recurringTransactions.userId, userId),
          eq(recurringTransactions.active, true),
          lte(recurringTransactions.startDate, asOf),
        ),
      );

    return rows.map(toDomain);
  }

  async save(rule: RecurringTransaction): Promise<void> {
    const values = {
      id: rule.id,
      userId: rule.userId,
      accountId: rule.accountId,
      categoryId: rule.categoryId ?? null,
      description: rule.description,
      amount: rule.amount.toFixed(2),
      type: rule.type,
      dayRuleKind: rule.dayRuleKind,
      dayRuleDay: rule.dayRuleDay ?? null,
      startDate: rule.startDate,
      endDate: rule.endDate ?? null,
      lastGeneratedThrough: rule.lastGeneratedThrough ?? null,
      active: rule.active,
      updatedAt: rule.props.updatedAt,
    };

    await this.executor
      .insert(recurringTransactions)
      .values({ ...values, createdAt: rule.props.createdAt })
      .onConflictDoUpdate({ target: recurringTransactions.id, set: values });
  }

  async delete(id: string): Promise<void> {
    await this.executor
      .delete(recurringTransactions)
      .where(eq(recurringTransactions.id, id));
  }
}
