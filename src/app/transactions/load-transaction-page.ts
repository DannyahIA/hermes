import type { TransactionGrouping } from '@/core/contracts/transaction-repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleMerchantRuleRepository } from '@/infra/repositories/drizzle-merchant-rule.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import {
  type CategorySuggestions,
  GetCategorySuggestionsUseCase,
} from '@/modules/categories/application/get-category-suggestions.use-case';
import { GetScheduledTransactionsUseCase } from '@/modules/transactions/application/get-scheduled-transactions.use-case';
import { GetTransactionPageUseCase } from '@/modules/transactions/application/get-transaction-page.use-case';
import {
  encodeTransactionCursor,
  type TransactionCursor,
} from '@/shared/lib/transaction-cursor';
import {
  toTransactionFilters,
  type TransactionQuery,
} from '@/shared/lib/transaction-query';

import {
  type ListedPage,
  type ListedScheduled,
  toListedTransaction,
} from './listed-transaction';

export const TRANSACTIONS_PAGE_SIZE = 50;

function suggestionsFor(
  userId: string,
  transactions: Parameters<
    GetCategorySuggestionsUseCase['execute']
  >[0]['transactions'],
  now: Date,
): Promise<CategorySuggestions> {
  return new GetCategorySuggestionsUseCase(
    new DrizzleTransactionRepository(),
    new DrizzleCategoryRepository(),
    new DrizzleMerchantRuleRepository(),
  ).execute({ userId, transactions, now });
}

/** One page of `/transactions`, for the page itself and for `GET /api/transactions`. */
export async function loadTransactionPage(
  userId: string,
  options: {
    query: TransactionQuery;
    grouping: TransactionGrouping;
    cursor?: TransactionCursor;
    limit?: number;
    now?: Date;
  },
): Promise<ListedPage> {
  const now = options.now ?? new Date();
  const page = await new GetTransactionPageUseCase(
    new DrizzleTransactionRepository(),
  ).execute({
    userId,
    filters: toTransactionFilters(options.query),
    grouping: options.grouping,
    cursor: options.cursor,
    limit: options.limit ?? TRANSACTIONS_PAGE_SIZE,
    now,
  });

  const suggestions = await suggestionsFor(userId, page.transactions, now);
  return {
    transactions: page.transactions.map(toListedTransaction),
    nextCursor: page.next ? encodeTransactionCursor(page.next) : null,
    totals: page.totals,
    suggestions: suggestions.categories,
    newCategories: suggestions.newCategories,
  };
}

/** What the filters match after today, shown above the list. */
export async function loadScheduled(
  userId: string,
  query: TransactionQuery,
  now = new Date(),
): Promise<ListedScheduled> {
  const scheduled = await new GetScheduledTransactionsUseCase(
    new DrizzleTransactionRepository(),
  ).execute({ userId, filters: toTransactionFilters(query), now });

  const suggestions = await suggestionsFor(userId, scheduled.transactions, now);
  return {
    transactions: scheduled.transactions.map(toListedTransaction),
    net: scheduled.net,
    suggestions: suggestions.categories,
    newCategories: suggestions.newCategories,
  };
}
