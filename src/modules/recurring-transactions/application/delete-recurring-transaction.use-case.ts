import type { RecurringTransactionRepository } from '@/core/contracts/recurring-transaction-repository';
import { NotFoundError } from '@/core/errors/not-found-error';

export interface DeleteRecurringTransactionInput {
  id: string;
  userId: string;
}

/**
 * Deletes the rule only — every transaction it already generated stays
 * exactly as it is (its `recurringRuleId` just becomes orphaned, see the
 * `ON DELETE SET NULL` on that column), so removing a rule never rewrites
 * financial history.
 */
export class DeleteRecurringTransactionUseCase {
  constructor(
    private readonly recurringTransactionRepository: RecurringTransactionRepository,
  ) {}

  async execute(input: DeleteRecurringTransactionInput): Promise<void> {
    const rule = await this.recurringTransactionRepository.findById(input.id);
    if (!rule || rule.userId !== input.userId) {
      throw new NotFoundError('RecurringTransaction', input.id);
    }

    await this.recurringTransactionRepository.delete(input.id);
  }
}
