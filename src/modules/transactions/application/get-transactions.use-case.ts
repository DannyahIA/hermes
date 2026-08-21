import type {
  TransactionFilters,
  TransactionRepository,
} from '@/core/contracts/transaction-repository';
import type { Transaction } from '@/core/entities/transaction';

export class GetTransactionsUseCase {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async execute(
    userId: string,
    filters?: TransactionFilters,
  ): Promise<Transaction[]> {
    return this.transactionRepository.findByUserId(userId, filters);
  }
}
