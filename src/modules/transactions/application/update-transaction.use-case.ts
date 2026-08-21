import type { AccountRepository } from '@/core/contracts/account-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import { Transaction } from '@/core/entities/transaction';
import { NotFoundError } from '@/core/errors/not-found-error';

/**
 * `type`/`accountId` are intentionally not editable — changing either
 * changes which account's balance the transaction affects and in which
 * direction, which is safer to model as delete-and-recreate than as an
 * in-place mutation.
 */
export interface UpdateTransactionInput {
  id: string;
  userId: string;
  description?: string;
  amount?: number;
  categoryId?: string;
  occurredAt?: Date;
}

export class UpdateTransactionUseCase {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly accountRepository: AccountRepository,
  ) {}

  async execute(input: UpdateTransactionInput): Promise<Transaction> {
    const transaction = await this.transactionRepository.findById(input.id);
    if (!transaction) {
      throw new NotFoundError('Transaction', input.id);
    }

    const account = await this.accountRepository.findById(
      transaction.accountId,
    );
    if (!account || account.userId !== input.userId) {
      throw new NotFoundError('Transaction', input.id);
    }

    const updatedTransaction = new Transaction({
      ...transaction.props,
      description: input.description ?? transaction.description,
      amount: input.amount ?? transaction.amount,
      categoryId: input.categoryId ?? transaction.categoryId,
      occurredAt: input.occurredAt ?? transaction.occurredAt,
      updatedAt: new Date(),
    });

    if (updatedTransaction.amount !== transaction.amount) {
      const amountChange = updatedTransaction.amount - transaction.amount;
      // Transfers aren't editable through this use-case (see the module
      // doc comment) but are handled defensively the same way as delete's
      // reversal, in case this is ever called on one directly.
      const delta =
        transaction.type === 'transfer'
          ? amountChange
          : account.deltaFor(transaction.type, amountChange);
      await this.accountRepository.save(account.withBalanceDelta(delta));
    }

    await this.transactionRepository.save(updatedTransaction);

    return updatedTransaction;
  }
}
