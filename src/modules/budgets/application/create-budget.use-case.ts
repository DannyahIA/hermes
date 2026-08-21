import type { BudgetRepository } from '@/core/contracts/budget-repository';
import type { CategoryRepository } from '@/core/contracts/category-repository';
import { Budget } from '@/core/entities/budget';
import { NotFoundError } from '@/core/errors/not-found-error';

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
  constructor(
    private readonly budgetRepository: BudgetRepository,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async execute(input: CreateBudgetInput): Promise<Budget> {
    const category = await this.categoryRepository.findById(input.categoryId);

    if (!category || category.userId !== input.userId) {
      throw new NotFoundError('Category', input.categoryId);
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
