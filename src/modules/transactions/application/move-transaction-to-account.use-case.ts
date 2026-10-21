import type { AccountRepository } from '@/core/contracts/account-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import { Transaction } from '@/core/entities/transaction';
import { DomainError } from '@/core/errors/domain-error';
import { NotFoundError } from '@/core/errors/not-found-error';

/**
 * Moves an income or expense to another of the user's accounts — the
 * "Foi no débito" of a Wallet card that pays both ways — undoing its effect
 * on the old account's balance and applying it to the new one. The
 * transaction keeps its id. `UpdateTransactionUseCase` doesn't change
 * accounts on purpose; this is the one place that does, for a plain
 * purchase or income only.
 */
export class MoveTransactionToAccountUseCase {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly accountRepository: AccountRepository,
  ) {}

  async execute(input: {
    userId: string;
    transactionId: string;
    accountId: string;
  }): Promise<Transaction> {
    const transaction = await this.transactionRepository.findById(
      input.transactionId,
    );
    const from = transaction
      ? await this.accountRepository.findById(transaction.accountId)
      : null;
    if (!transaction || !from || from.userId !== input.userId) {
      throw new NotFoundError('Transaction', input.transactionId);
    }
    if (
      transaction.type === 'transfer' ||
      transaction.isCardBillPayment ||
      transaction.installmentPlanId
    ) {
      throw new DomainError(
        'Only a plain income or expense moves to another account.',
        'NOT_MOVABLE',
      );
    }
    if (transaction.accountId === input.accountId) return transaction;

    const to = await this.accountRepository.findById(input.accountId);
    if (!to || to.userId !== input.userId) {
      throw new NotFoundError('Account', input.accountId);
    }
    if (to.archived) {
      throw new DomainError(
        'An archived account cannot receive new transactions.',
        'ACCOUNT_ARCHIVED',
      );
    }

    const type = transaction.type as 'income' | 'expense';
    await this.accountRepository.save(
      from.withBalanceDelta(-from.deltaFor(type, transaction.amount)),
    );
    await this.accountRepository.save(
      to.withBalanceDelta(to.deltaFor(type, transaction.amount)),
    );
    const moved = new Transaction({
      ...transaction.props,
      accountId: to.id,
      updatedAt: new Date(),
    });
    await this.transactionRepository.save(moved);
    return moved;
  }
}
