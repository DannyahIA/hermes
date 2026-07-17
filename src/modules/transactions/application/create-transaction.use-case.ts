import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import { Transaction } from '@/core/entities/transaction';
import { ValidationError } from '@/core/errors/validation-error';

export interface CreateTransactionInput {
  id: string;
  accountId: string;
  categoryId?: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  occurredAt?: Date;
}

export class CreateTransactionUseCase {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async execute(input: CreateTransactionInput): Promise<Transaction> {
    if (!input.description.trim()) {
      throw new ValidationError('Transaction description is required.');
    }

    const transaction = new Transaction({
      ...input,
      occurredAt: input.occurredAt ?? new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await this.transactionRepository.save(transaction);

    return transaction;
  }
}
