import type { RecurringTransactionRepository } from '@/core/contracts/recurring-transaction-repository';
import type { RecurringTransaction } from '@/core/entities/recurring-transaction';

export class FakeRecurringTransactionRepository implements RecurringTransactionRepository {
  private readonly rules = new Map<string, RecurringTransaction>();

  async findById(id: string): Promise<RecurringTransaction | null> {
    return this.rules.get(id) ?? null;
  }

  async findByUserId(userId: string): Promise<RecurringTransaction[]> {
    return [...this.rules.values()].filter((r) => r.userId === userId);
  }

  async findDueForGeneration(
    userId: string,
    asOf: Date,
  ): Promise<RecurringTransaction[]> {
    return [...this.rules.values()].filter(
      (r) => r.userId === userId && r.active && r.startDate <= asOf,
    );
  }

  async save(rule: RecurringTransaction): Promise<void> {
    this.rules.set(rule.id, rule);
  }

  async delete(id: string): Promise<void> {
    this.rules.delete(id);
  }
}
