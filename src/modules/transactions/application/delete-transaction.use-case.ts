import type { AccountRepository } from '@/core/contracts/account-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import { NotFoundError } from '@/core/errors/not-found-error';

export interface DeleteTransactionInput {
  id: string;
  userId: string;
}

/**
 * Deleting a transaction reverts its effect on the account balance — the
 * balance must never drift from "sum of remaining transactions".
 */
export class DeleteTransactionUseCase {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly accountRepository: AccountRepository,
  ) {}

  async execute(input: DeleteTransactionInput): Promise<void> {
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

    // Transfer legs don't go through the income/expense sign convention
    // (see TransferMoneyUseCase) — reversing one restores the pre-transfer
    // balance the same way it was always subtracted here, regardless of
    // account type.
    const reversal =
      transaction.type === 'transfer'
        ? transaction.amount
        : -account.deltaFor(transaction.type, transaction.amount);
    const updatedAccount = account.withBalanceDelta(reversal);

    await this.accountRepository.save(updatedAccount);
    await this.transactionRepository.delete(input.id);
  }
}
