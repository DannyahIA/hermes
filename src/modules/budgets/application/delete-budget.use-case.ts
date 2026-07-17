import type { BudgetRepository } from '@/core/contracts/budget-repository';
import { ValidationError } from '@/core/errors/validation-error';

export interface DeleteBudgetInput {
  id: string;
}

export class DeleteBudgetUseCase {
  constructor(private readonly budgetRepository: BudgetRepository) {}

  async execute(input: DeleteBudgetInput): Promise<void> {
    const budget = await this.budgetRepository.findById(input.id);

    if (!budget) {
      throw new ValidationError('Budget not found.');
    }

    await this.budgetRepository.save(budget);
  }
}
