import type { TransactionViewMode } from '@/config/constants';
import type { TransactionGrouping } from '@/core/contracts/transaction-repository';
import type { Transaction } from '@/core/entities/transaction';
import { formatTimeOfDay } from '@/shared/lib/format-date';
import { toDateInput } from '@/shared/lib/local-day';

/**
 * A transaction as the list shows it. Its day and time are read on the
 * server, so a browser in another time zone draws the same headings the
 * server did (and hydration never disagrees).
 */
export interface ListedTransaction {
  id: string;
  /** As stored, installment suffix included: see `splitOrigin`. */
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  accountId: string;
  categoryId: string | null;
  /** The card a bill payment settles. */
  settlesAccountId: string | null;
  installmentPlanId: string | null;
  recurringRuleId: string | null;
  /** "2026-10-13". */
  day: string;
  /** "12:41", or null for an entry stored at midnight. */
  time: string | null;
}

/** One page of the list, as the page renders it and the endpoint returns it. */
export interface ListedPage {
  transactions: ListedTransaction[];
  nextCursor: string | null;
  /** In minus out for each group on the page, over all of the group. */
  totals: Record<string, number>;
  /** Category ids to offer beside "Sem categoria", by transaction id. */
  suggestions: Record<string, string[]>;
}

export interface ListedScheduled {
  /** Soonest first. */
  transactions: ListedTransaction[];
  net: number;
  suggestions: Record<string, string[]>;
}

export const GROUPING_BY_VIEW_MODE: Record<
  TransactionViewMode,
  TransactionGrouping
> = {
  chronological: 'day',
  grouped_by_month: 'month',
  grouped_by_category: 'category',
};

export function isGrouping(value: unknown): value is TransactionGrouping {
  return value === 'day' || value === 'month' || value === 'category';
}

/** Whether it can be filed under a category (see `Transaction#takesCategory`). */
export function takesCategory(transaction: ListedTransaction): boolean {
  return transaction.type !== 'transfer' && !transaction.settlesAccountId;
}

export function toListedTransaction(
  transaction: Transaction,
): ListedTransaction {
  return {
    id: transaction.id,
    description: transaction.description,
    amount: transaction.amount,
    type: transaction.type,
    accountId: transaction.accountId,
    categoryId: transaction.categoryId ?? null,
    settlesAccountId: transaction.settlesAccountId ?? null,
    installmentPlanId: transaction.installmentPlanId ?? null,
    recurringRuleId: transaction.recurringRuleId ?? null,
    day: toDateInput(transaction.occurredAt),
    time: formatTimeOfDay(transaction.occurredAt),
  };
}
