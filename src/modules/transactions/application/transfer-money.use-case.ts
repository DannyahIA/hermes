import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import { Transaction } from '@/core/entities/transaction';
import { ValidationError } from '@/core/errors/validation-error';

export interface TransferMoneyInput {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  description: string;
  occurredAt?: Date;
}

export class TransferMoneyUseCase {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async execute(input: TransferMoneyInput): Promise<Transaction[]> {
    if (input.fromAccountId === input.toAccountId) {
      throw new ValidationError('Accounts must be different for a transfer.');
    }

    const transactions = [
      new Transaction({
        id: `${input.id}-out`,
        accountId: input.fromAccountId,
        description: input.description,
        amount: -Math.abs(input.amount),
        type: 'transfer',
        occurredAt: input.occurredAt ?? new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      new Transaction({
        id: `${input.id}-in`,
        accountId: input.toAccountId,
        description: input.description,
        amount: Math.abs(input.amount),
        type: 'transfer',
        occurredAt: input.occurredAt ?? new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ];

    await Promise.all(
      transactions.map((transaction) =>
        this.transactionRepository.save(transaction),
      ),
    );

    return transactions;
  }
}
