import type { BudgetRepository } from '@/core/contracts/budget-repository';
import type { CategoryRepository } from '@/core/contracts/category-repository';
import { Budget, type BudgetKind } from '@/core/entities/budget';
import { NotFoundError } from '@/core/errors/not-found-error';
import { ValidationError } from '@/core/errors/validation-error';
import { DateRange } from '@/core/value-objects/date-range';

export interface CreateBudgetInput {
  id: string;
  userId: string;
  categoryId: string;
  amount: number;
  currency: string;
  kind: BudgetKind;
  /** Only for `fixed`; a monthly budget starts this month and has no end. */
  periodStart?: Date;
  periodEnd?: Date;
  /** Defaults to the present; the month a monthly budget starts in. */
  now?: Date;
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

    const { now = new Date(), periodStart, periodEnd, ...rest } = input;

    if (input.kind === 'fixed' && (!periodStart || !periodEnd)) {
      throw new ValidationError(
        'A budget with dates needs a start and an end.',
      );
    }

    const budget = new Budget({
      ...rest,
      limits: [],
      periodStart:
        input.kind === 'monthly'
          ? DateRange.monthOf(now).start
          : (periodStart as Date),
      periodEnd: input.kind === 'monthly' ? null : (periodEnd as Date),
      createdAt: now,
      updatedAt: now,
    });

    await this.budgetRepository.save(budget);

    return budget;
  }
}
