import type { Transaction } from '@/core/entities/transaction';

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
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

export interface TransactionRepository {
  findById(id: string): Promise<Transaction | null>;
  findByAccountId(accountId: string): Promise<Transaction[]>;
  findByUserId(
    userId: string,
    filters?: TransactionFilters,
  ): Promise<Transaction[]>;
  findByInstallmentPlanId(installmentPlanId: string): Promise<Transaction[]>;
  save(transaction: Transaction): Promise<void>;
  delete(id: string): Promise<void>;
}
