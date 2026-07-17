import type { Budget } from '@/core/entities/budget';

export interface BudgetRepository {
  findById(id: string): Promise<Budget | null>;
  findByUserId(userId: string): Promise<Budget[]>;
  save(budget: Budget): Promise<void>;
}
