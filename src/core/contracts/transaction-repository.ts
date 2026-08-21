import type { Transaction } from '@/core/entities/transaction';

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  type?: Transaction['type'];
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
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
