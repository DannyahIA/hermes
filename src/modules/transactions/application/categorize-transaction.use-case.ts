import type { AccountRepository } from '@/core/contracts/account-repository';
import type { CategoryRepository } from '@/core/contracts/category-repository';
import type { MerchantRuleRepository } from '@/core/contracts/merchant-rule-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import type { MerchantRule } from '@/core/entities/merchant-rule';
import type { Transaction } from '@/core/entities/transaction';
import { DomainError } from '@/core/errors/domain-error';
import { NotFoundError } from '@/core/errors/not-found-error';
import { rememberMerchantCategory } from '@/modules/categories/application/remember-merchant-category';

import { UpdateTransactionUseCase } from './update-transaction.use-case';

export interface CategorizeTransactionInput {
  userId: string;
  transactionId: string;
  categoryId: string;
}

export interface CategorizeTransactionResult {
  transaction: Transaction;
  /** The rule learned from this choice; null when the description names no merchant. */
  rule: MerchantRule | null;
}

/**
 * Files a transaction under a category and remembers the choice for its
 * merchant (spec 2026-10-17-inicio-hub-design.md §4.2), so the next
 * purchase there is suggested the same way. Used by "Para revisar" on the
 * Início and, later, by the Telegram buttons.
 */
export class CategorizeTransactionUseCase {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly accountRepository: AccountRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly merchantRuleRepository: MerchantRuleRepository,
  ) {}

  async execute(
    input: CategorizeTransactionInput,
  ): Promise<CategorizeTransactionResult> {
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

    const current = await this.transactionRepository.findById(
      input.transactionId,
    );
    if (current?.type === 'transfer') {
      throw new DomainError(
        'A transfer between accounts has no category.',
        'TRANSFER_HAS_NO_CATEGORY',
      );
    }
    // What it pays for was already filed, purchase by purchase, on the card.
    if (current?.isCardBillPayment) {
      throw new DomainError(
        'A card bill payment has no category.',
        'BILL_PAYMENT_HAS_NO_CATEGORY',
      );
    }

    // Also checks that the transaction belongs to the user.
    const transaction = await new UpdateTransactionUseCase(
      this.transactionRepository,
      this.accountRepository,
    ).execute({
      id: input.transactionId,
      userId: input.userId,
      categoryId: input.categoryId,
    });

    const rule = await rememberMerchantCategory(this.merchantRuleRepository, {
      userId: input.userId,
      description: transaction.description,
      categoryId: input.categoryId,
    });
    return { transaction, rule };
  }
}
