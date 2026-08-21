import type { RecurringTransaction } from '@/core/entities/recurring-transaction';

export interface RecurringTransactionRepository {
  findById(id: string): Promise<RecurringTransaction | null>;
  findByUserId(userId: string): Promise<RecurringTransaction[]>;
  /**
   * Active rules for this user that may have an occurrence due on or
   * before `asOf` not yet materialized. A cheap pre-filter (active +
   * startDate <= asOf) — the exact occurrence dates are still resolved by
   * `core/value-objects/recurrence.ts`, this just narrows the candidate
   * set before that math runs.
   */
  findDueForGeneration(
    userId: string,
    asOf: Date,
  ): Promise<RecurringTransaction[]>;
  save(rule: RecurringTransaction): Promise<void>;
  delete(id: string): Promise<void>;
}
