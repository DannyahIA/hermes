import type { BudgetRepository } from '@/core/contracts/budget-repository';
import type { Budget } from '@/core/entities/budget';

export class GetBudgetsUseCase {
  constructor(private readonly budgetRepository: BudgetRepository) {}

  async execute(userId: string): Promise<Budget[]> {
    return this.budgetRepository.findByUserId(userId);
  }
}
