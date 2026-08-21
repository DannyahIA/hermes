import type { BudgetRepository } from '@/core/contracts/budget-repository';
import { NotFoundError } from '@/core/errors/not-found-error';

export interface DeleteBudgetInput {
  id: string;
  userId: string;
}

export class DeleteBudgetUseCase {
  constructor(private readonly budgetRepository: BudgetRepository) {}

  async execute(input: DeleteBudgetInput): Promise<void> {
    const budget = await this.budgetRepository.findById(input.id);

    if (!budget || budget.userId !== input.userId) {
      throw new NotFoundError('Budget', input.id);
    }

    await this.budgetRepository.delete(input.id);
  }
}
