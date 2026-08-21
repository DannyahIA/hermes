import type { BudgetRepository } from '@/core/contracts/budget-repository';
import type { Budget } from '@/core/entities/budget';

export class FakeBudgetRepository implements BudgetRepository {
  private readonly budgets = new Map<string, Budget>();

  async findById(id: string): Promise<Budget | null> {
    return this.budgets.get(id) ?? null;
  }

  async findByUserId(userId: string): Promise<Budget[]> {
    return [...this.budgets.values()].filter((b) => b.userId === userId);
  }

  async save(budget: Budget): Promise<void> {
    this.budgets.set(budget.id, budget);
  }

  async delete(id: string): Promise<void> {
    this.budgets.delete(id);
  }
}
