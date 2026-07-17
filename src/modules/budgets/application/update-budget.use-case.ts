import type { BudgetRepository } from '@/core/contracts/budget-repository';
import { Budget } from '@/core/entities/budget';
import { ValidationError } from '@/core/errors/validation-error';

export interface UpdateBudgetInput {
  id: string;
  amount?: number;
  currency?: string;
  periodStart?: Date;
  periodEnd?: Date;
}

export class UpdateBudgetUseCase {
  constructor(private readonly budgetRepository: BudgetRepository) {}

  async execute(input: UpdateBudgetInput): Promise<Budget> {
    const budget = await this.budgetRepository.findById(input.id);

    if (!budget) {
      throw new ValidationError('Budget not found.');
    }

    const updatedBudget = new Budget({
      ...budget.props,
      ...input,
      updatedAt: new Date(),
    });

    await this.budgetRepository.save(updatedBudget);

    return updatedBudget;
  }
}
