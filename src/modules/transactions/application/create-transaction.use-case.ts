import type { AccountRepository } from '@/core/contracts/account-repository';
import type { CategoryRepository } from '@/core/contracts/category-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import { Transaction } from '@/core/entities/transaction';
import { DomainError } from '@/core/errors/domain-error';
import { NotFoundError } from '@/core/errors/not-found-error';

export interface CreateTransactionInput {
  id: string;
  userId: string;
  accountId: string;
  categoryId?: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  occurredAt?: Date;
}

/**
 * Creates an income or expense and, in the same call, updates the owning
 * account's balance — the two must be constructed with repositories bound
 * to the same unit-of-work transaction (see `infra/database/transaction.ts`)
 * so they either both land or neither does.
 */
export class CreateTransactionUseCase {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly accountRepository: AccountRepository,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async execute(input: CreateTransactionInput): Promise<Transaction> {
    const account = await this.accountRepository.findById(input.accountId);
    if (!account || account.userId !== input.userId) {
      throw new NotFoundError('Account', input.accountId);
    }

    if (input.categoryId) {
      const category = await this.categoryRepository.findById(input.categoryId);
      if (!category || category.userId !== input.userId) {
        throw new NotFoundError('Category', input.categoryId);
      }
      if (category.archived) {
        throw new DomainError(
          'An archived category cannot receive new transactions.',
          'CATEGORY_ARCHIVED',
        );
      }
    }

    const transaction = new Transaction({
      id: input.id,
      accountId: input.accountId,
      categoryId: input.categoryId,
      description: input.description,
      amount: input.amount,
      type: input.type,
      occurredAt: input.occurredAt ?? new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const delta = account.deltaFor(input.type, transaction.amount);
    const updatedAccount = account.withBalanceDelta(delta);

    await this.accountRepository.save(updatedAccount);
    await this.transactionRepository.save(transaction);

    return transaction;
  }
}
