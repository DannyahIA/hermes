import type {
  TransactionFilters,
  TransactionRepository,
} from '@/core/contracts/transaction-repository';
import type { Transaction } from '@/core/entities/transaction';

export class FakeTransactionRepository implements TransactionRepository {
  private readonly transactions = new Map<string, Transaction>();

  async findById(id: string): Promise<Transaction | null> {
    return this.transactions.get(id) ?? null;
  }

  async findByAccountId(accountId: string): Promise<Transaction[]> {
    return [...this.transactions.values()].filter(
      (t) => t.accountId === accountId,
    );
  }

  async findByUserId(
    _userId: string,
    filters: TransactionFilters = {},
  ): Promise<Transaction[]> {
    return [...this.transactions.values()]
      .filter((t) => {
        if (filters.accountId && t.accountId !== filters.accountId)
          return false;
        if (filters.categoryId && t.categoryId !== filters.categoryId)
          return false;
        if (filters.type && t.type !== filters.type) return false;
        if (filters.from && t.occurredAt < filters.from) return false;
        if (filters.to && t.occurredAt > filters.to) return false;
        return true;
      })
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  }

  async findByInstallmentPlanId(
    installmentPlanId: string,
  ): Promise<Transaction[]> {
    return [...this.transactions.values()]
      .filter((t) => t.installmentPlanId === installmentPlanId)
      .sort((a, b) => (a.installmentNumber ?? 0) - (b.installmentNumber ?? 0));
  }

  async save(transaction: Transaction): Promise<void> {
    this.transactions.set(transaction.id, transaction);
  }

  async delete(id: string): Promise<void> {
    this.transactions.delete(id);
  }
}
