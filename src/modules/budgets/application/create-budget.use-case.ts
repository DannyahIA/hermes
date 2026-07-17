import type { BudgetRepository } from '@/core/contracts/budget-repository';
import { Budget } from '@/core/entities/budget';
import { ValidationError } from '@/core/errors/validation-error';

export interface CreateBudgetInput {
  id: string;
  userId: string;
  categoryId: string;
  amount: number;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
}

export class CreateBudgetUseCase {
  constructor(private readonly budgetRepository: BudgetRepository) {}

  async execute(input: CreateBudgetInput): Promise<Budget> {
    if (input.amount <= 0) {
      throw new ValidationError('Budget amount must be greater than zero.');
    }

    const budget = new Budget({
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await this.budgetRepository.save(budget);

    return budget;
  }
}
