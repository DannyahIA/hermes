import type { BudgetRepository } from '@/core/contracts/budget-repository';
import { NotFoundError } from '@/core/errors/not-found-error';

export interface ChangeBudgetLimitInput {
  userId: string;
  budgetId: string;
  amount: number;
  /** When the change is made: a monthly budget uses the new limit from this month on. */
  now: Date;
}

export class ChangeBudgetLimitUseCase {
  constructor(private readonly budgetRepository: BudgetRepository) {}

  async execute(input: ChangeBudgetLimitInput): Promise<void> {
    const budget = await this.budgetRepository.findById(input.budgetId);

    if (!budget || budget.userId !== input.userId) {
      throw new NotFoundError('Budget', input.budgetId);
    }

    await this.budgetRepository.save(budget.withLimit(input.amount, input.now));
  }
}
