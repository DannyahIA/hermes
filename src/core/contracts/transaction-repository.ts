import type { Transaction } from '@/core/entities/transaction';

export interface TransactionFilters {
  /** Part of the description, compared without case or accents. */
  search?: string;
  accountId?: string;
  categoryId?: string;
  /** Only income and expenses still without a category — transfers and
   * card bill payments never take one. */
  uncategorized?: boolean;
  type?: Transaction['type'];
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
  /** Keyset pagination cursor — when set, only rows strictly "older" than
   * this (occurredAt, id) pair (in the same DESC order the list is sorted
   * by) are returned. Takes precedence over `page`/`pageSize`'s offset. */
  cursor?: { occurredAt: Date; id: string };
}

/** How the transaction list can be grouped. */
export type TransactionGrouping = 'day' | 'month' | 'category';

/** What came in and what went out in one group of transactions. */
export interface GroupTotal {
  /**
   * A local calendar day ("2026-10-13"), a month ("2026-10"), or a
   * category id ("none" for the uncategorized).
   */
  key: string;
  income: number;
  expense: number;
}

export interface TransactionRepository {
  findById(id: string): Promise<Transaction | null>;
  findByAccountId(accountId: string): Promise<Transaction[]>;
  findByUserId(
    userId: string,
    filters?: TransactionFilters,
  ): Promise<Transaction[]>;
  /**
   * Income and expenses per group over every row `filters` match (its
   * paging fields aside). Transfers and card bill payments are left out:
   * they only move money between the user's own accounts.
   */
  totalsBy(
    userId: string,
    grouping: TransactionGrouping,
    filters?: TransactionFilters,
  ): Promise<GroupTotal[]>;
  findByInstallmentPlanId(installmentPlanId: string): Promise<Transaction[]>;
  save(transaction: Transaction): Promise<void>;
  delete(id: string): Promise<void>;
}
