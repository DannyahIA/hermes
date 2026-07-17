import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import { Transaction } from '@/core/entities/transaction';
import { ValidationError } from '@/core/errors/validation-error';

export interface UpdateTransactionInput {
  id: string;
  description?: string;
  amount?: number;
  type?: 'income' | 'expense' | 'transfer';
  occurredAt?: Date;
}

export class UpdateTransactionUseCase {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async execute(input: UpdateTransactionInput): Promise<Transaction> {
    const transaction = await this.transactionRepository.findById(input.id);

    if (!transaction) {
      throw new ValidationError('Transaction not found.');
    }

    const updatedTransaction = new Transaction({
      ...transaction.props,
      ...input,
      updatedAt: new Date(),
    });

    await this.transactionRepository.save(updatedTransaction);

    return updatedTransaction;
  }
}
