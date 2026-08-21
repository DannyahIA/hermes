import type { BudgetRepository } from '@/core/contracts/budget-repository';
import type { Budget } from '@/core/entities/budget';
import { NotFoundError } from '@/core/errors/not-found-error';

export interface GetBudgetInput {
  id: string;
  userId: string;
}

export class GetBudgetUseCase {
  constructor(private readonly budgetRepository: BudgetRepository) {}

  async execute(input: GetBudgetInput): Promise<Budget> {
    const budget = await this.budgetRepository.findById(input.id);

    if (!budget || budget.userId !== input.userId) {
      throw new NotFoundError('Budget', input.id);
    }

    return budget;
  }
}
