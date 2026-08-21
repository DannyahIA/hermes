import type { AccountRepository } from '@/core/contracts/account-repository';
import type { CategoryRepository } from '@/core/contracts/category-repository';
import type { RecurringTransactionRepository } from '@/core/contracts/recurring-transaction-repository';
import {
  type DayRuleKind,
  RecurringTransaction,
} from '@/core/entities/recurring-transaction';
import { DomainError } from '@/core/errors/domain-error';
import { NotFoundError } from '@/core/errors/not-found-error';

export interface CreateRecurringTransactionInput {
  id: string;
  userId: string;
  accountId: string;
  categoryId?: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  dayRuleKind: DayRuleKind;
  dayRuleDay?: number;
  startDate: Date;
  endDate?: Date;
}

export class CreateRecurringTransactionUseCase {
  constructor(
    private readonly recurringTransactionRepository: RecurringTransactionRepository,
    private readonly accountRepository: AccountRepository,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async execute(
    input: CreateRecurringTransactionInput,
  ): Promise<RecurringTransaction> {
    const account = await this.accountRepository.findById(input.accountId);
    if (!account || account.userId !== input.userId) {
      throw new NotFoundError('Account', input.accountId);
    }

    if (input.categoryId) {
      const category = await this.categoryRepository.findById(input.categoryId);
      if (!category || category.userId !== input.userId) {
        throw new NotFoundError('Category', input.categoryId);
      }
      if (category.archived) {
        throw new DomainError(
          'An archived category cannot receive new transactions.',
          'CATEGORY_ARCHIVED',
        );
      }
    }

    const rule = new RecurringTransaction({
      ...input,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await this.recurringTransactionRepository.save(rule);

    return rule;
  }
}
