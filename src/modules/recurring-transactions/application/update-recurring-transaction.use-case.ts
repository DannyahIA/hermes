import type { RecurringTransactionRepository } from '@/core/contracts/recurring-transaction-repository';
import type {
  DayRuleKind,
  RecurringTransaction,
} from '@/core/entities/recurring-transaction';
import { NotFoundError } from '@/core/errors/not-found-error';

export interface UpdateRecurringTransactionInput {
  id: string;
  userId: string;
  description?: string;
  amount?: number;
  categoryId?: string;
  dayRuleKind?: DayRuleKind;
  dayRuleDay?: number;
  endDate?: Date | null;
  active?: boolean;
}

export class UpdateRecurringTransactionUseCase {
  constructor(
    private readonly recurringTransactionRepository: RecurringTransactionRepository,
  ) {}

  async execute(
    input: UpdateRecurringTransactionInput,
  ): Promise<RecurringTransaction> {
    const rule = await this.recurringTransactionRepository.findById(input.id);
    if (!rule || rule.userId !== input.userId) {
      throw new NotFoundError('RecurringTransaction', input.id);
    }

    const updated = rule.update(input);
    await this.recurringTransactionRepository.save(updated);

    return updated;
  }
}
