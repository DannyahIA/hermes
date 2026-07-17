import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import { ValidationError } from '@/core/errors/validation-error';

export interface DeleteTransactionInput {
  id: string;
}

export class DeleteTransactionUseCase {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async execute(input: DeleteTransactionInput): Promise<void> {
    const transaction = await this.transactionRepository.findById(input.id);

    if (!transaction) {
      throw new ValidationError('Transaction not found.');
    }

    await this.transactionRepository.save(transaction);
  }
}
