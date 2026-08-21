import type { BudgetRepository } from '@/core/contracts/budget-repository';
import { Budget } from '@/core/entities/budget';
import { NotFoundError } from '@/core/errors/not-found-error';

export interface UpdateBudgetInput {
  id: string;
  userId: string;
  amount?: number;
  currency?: string;
  periodStart?: Date;
  periodEnd?: Date;
}

export class UpdateBudgetUseCase {
  constructor(private readonly budgetRepository: BudgetRepository) {}

  async execute(input: UpdateBudgetInput): Promise<Budget> {
    const budget = await this.budgetRepository.findById(input.id);

    if (!budget || budget.userId !== input.userId) {
      throw new NotFoundError('Budget', input.id);
    }

    const updatedBudget = new Budget({
      ...budget.props,
      amount: input.amount ?? budget.amount,
      currency: input.currency ?? budget.currency,
      periodStart: input.periodStart ?? budget.periodStart,
      periodEnd: input.periodEnd ?? budget.periodEnd,
      updatedAt: new Date(),
    });

    await this.budgetRepository.save(updatedBudget);

    return updatedBudget;
  }
}
