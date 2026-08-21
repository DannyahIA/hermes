import type { RecurringTransactionRepository } from '@/core/contracts/recurring-transaction-repository';
import type { RecurringTransaction } from '@/core/entities/recurring-transaction';

export class GetRecurringTransactionsUseCase {
  constructor(
    private readonly recurringTransactionRepository: RecurringTransactionRepository,
  ) {}

  async execute(userId: string): Promise<RecurringTransaction[]> {
    return this.recurringTransactionRepository.findByUserId(userId);
  }
}
