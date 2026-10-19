import type {
  TransactionFilters,
  TransactionRepository,
} from '@/core/contracts/transaction-repository';
import type { Transaction } from '@/core/entities/transaction';

export interface ScheduledTransactions {
  /** Soonest first. */
  transactions: Transaction[];
  /** What will come in minus what will go out. */
  net: number;
}

/**
 * What is dated after today and matches the list's filters — mostly the
 * installments still to come. The transaction list shows them apart, above
 * what already happened.
 */
export class GetScheduledTransactionsUseCase {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async execute(input: {
    userId: string;
    filters: TransactionFilters;
    now?: Date;
  }): Promise<ScheduledTransactions> {
    const now = input.now ?? new Date();
    const tomorrow = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    const { to } = input.filters;
    if (to && to < tomorrow) return { transactions: [], net: 0 };

    const from =
      input.filters.from && input.filters.from > tomorrow
        ? input.filters.from
        : tomorrow;
    const rows = await this.transactionRepository.findByUserId(input.userId, {
      ...input.filters,
      from,
      cursor: undefined,
      page: undefined,
      pageSize: 10_000,
    });

    const transactions = rows.reverse();
    let net = 0;
    for (const transaction of transactions) {
      if (transaction.countsAs('income')) net += transaction.amount;
      if (transaction.countsAs('expense')) net -= transaction.amount;
    }
    return { transactions, net: Math.round(net * 100) / 100 };
  }
}
