import type {
  GroupTotal,
  TransactionFilters,
  TransactionGrouping,
  TransactionRepository,
} from '@/core/contracts/transaction-repository';
import type { Transaction } from '@/core/entities/transaction';
import { foldText } from '@/shared/lib/fold-text';
import { toDateInput } from '@/shared/lib/local-day';

/** Like the Drizzle repository: a page holds 50 rows unless told otherwise. */
const DEFAULT_PAGE_SIZE = 50;

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Strictly after the cursor in newest-first order (the keyset predicate). */
function isOlder(
  transaction: Transaction,
  cursor: NonNullable<TransactionFilters['cursor']>,
): boolean {
  const at = transaction.occurredAt.getTime();
  const cursorAt = cursor.occurredAt.getTime();
  return at < cursorAt || (at === cursorAt && transaction.id < cursor.id);
}

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
    const search = filters.search ? foldText(filters.search).trim() : '';
    return [...this.transactions.values()]
      .filter((t) => {
        if (search && !foldText(t.description).includes(search)) return false;
        if (filters.accountId && t.accountId !== filters.accountId)
          return false;
        if (filters.categoryId && t.categoryId !== filters.categoryId)
          return false;
        if (
          filters.uncategorized &&
          (t.categoryId || t.type === 'transfer' || t.isCardBillPayment)
        )
          return false;
        if (filters.type && t.type !== filters.type) return false;
        if (filters.from && t.occurredAt < filters.from) return false;
        if (filters.to && t.occurredAt > filters.to) return false;
        if (filters.cursor && !isOlder(t, filters.cursor)) return false;
        return true;
      })
      .sort(
        (a, b) =>
          b.occurredAt.getTime() - a.occurredAt.getTime() ||
          compareIds(b.id, a.id),
      )
      .slice(0, filters.pageSize ?? DEFAULT_PAGE_SIZE);
  }

  async totalsBy(
    userId: string,
    grouping: TransactionGrouping,
    filters: TransactionFilters = {},
  ): Promise<GroupTotal[]> {
    const rows = await this.findByUserId(userId, {
      ...filters,
      cursor: undefined,
      pageSize: Number.POSITIVE_INFINITY,
    });
    const totals = new Map<string, GroupTotal>();
    for (const t of rows) {
      if (!t.countsAs('income') && !t.countsAs('expense')) continue;
      const key =
        grouping === 'category'
          ? (t.categoryId ?? 'none')
          : toDateInput(t.occurredAt).slice(0, grouping === 'day' ? 10 : 7);
      const total = totals.get(key) ?? { key, income: 0, expense: 0 };
      if (t.type === 'income') total.income += t.amount;
      else total.expense += t.amount;
      totals.set(key, total);
    }
    return [...totals.values()];
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
