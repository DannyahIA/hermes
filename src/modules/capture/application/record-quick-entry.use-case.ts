import type { AccountRepository } from '@/core/contracts/account-repository';
import type { CategoryRepository } from '@/core/contracts/category-repository';
import type { MerchantRuleRepository } from '@/core/contracts/merchant-rule-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import type { MerchantRule } from '@/core/entities/merchant-rule';
import type { Transaction } from '@/core/entities/transaction';
import { rememberMerchantCategory } from '@/modules/categories/application/remember-merchant-category';
import {
  type CreateTransactionInput,
  CreateTransactionUseCase,
} from '@/modules/transactions/application/create-transaction.use-case';

export type RecordQuickEntryInput = CreateTransactionInput & {
  occurredAt: Date;
};

export interface RecordQuickEntryResult {
  transaction: Transaction;
  /** The rule learned when a category was chosen; null otherwise. */
  rule: MerchantRule | null;
}

/**
 * Records what was understood from a one-line entry (`parseQuickEntry`):
 * the Início's quick entry today, the Telegram bot's text messages later.
 * A category chosen for the entry is remembered for its merchant, as a
 * choice in "Para revisar" is, so the next entry there is filed the same
 * way. Construct it with repositories bound to one unit of work.
 */
export class RecordQuickEntryUseCase {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly accountRepository: AccountRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly merchantRuleRepository: MerchantRuleRepository,
  ) {}

  async execute(input: RecordQuickEntryInput): Promise<RecordQuickEntryResult> {
    const transaction = await new CreateTransactionUseCase(
      this.transactionRepository,
      this.accountRepository,
      this.categoryRepository,
    ).execute(input);

    const rule = input.categoryId
      ? await rememberMerchantCategory(this.merchantRuleRepository, {
          userId: input.userId,
          description: transaction.description,
          categoryId: input.categoryId,
        })
      : null;

    return { transaction, rule };
  }
}
