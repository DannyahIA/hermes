import type { CategoryRepository } from '@/core/contracts/category-repository';
import type { MerchantRuleRepository } from '@/core/contracts/merchant-rule-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import type { Transaction } from '@/core/entities/transaction';

import {
  createCategorySuggester,
  SUGGESTION_HISTORY_DAYS,
} from './suggest-categories';

/**
 * Up to three categories for each transaction in `transactions` that
 * still needs one — the one-tap choices beside "Sem categoria" in a list
 * (spec 2026-10-17-inicio-hub-design.md §4.2 and §5). Reads nothing when
 * none of them does.
 */
export class GetCategorySuggestionsUseCase {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly merchantRuleRepository: MerchantRuleRepository,
  ) {}

  async execute(input: {
    userId: string;
    transactions: Transaction[];
    now?: Date;
  }): Promise<Record<string, string[]>> {
    const open = input.transactions.filter(
      (transaction) => !transaction.categoryId && transaction.takesCategory,
    );
    if (open.length === 0) return {};

    const now = input.now ?? new Date();
    const [categories, rules, history] = await Promise.all([
      this.categoryRepository.findByUserId(input.userId),
      this.merchantRuleRepository.findByUserId(input.userId),
      this.transactionRepository.findByUserId(input.userId, {
        from: new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - SUGGESTION_HISTORY_DAYS,
        ),
        to: now,
        pageSize: 10_000,
      }),
    ]);
    const suggest = createCategorySuggester({
      categoryIds: categories
        .filter((category) => !category.archived)
        .map((category) => category.id),
      rules,
      history: history.filter((transaction) => transaction.categoryId),
    });

    return Object.fromEntries(
      open.map((transaction) => [
        transaction.id,
        suggest(transaction.description, transaction.type),
      ]),
    );
  }
}
