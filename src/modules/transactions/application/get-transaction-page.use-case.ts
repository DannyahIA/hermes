import type {
  TransactionFilters,
  TransactionGrouping,
  TransactionRepository,
} from '@/core/contracts/transaction-repository';
import type { Transaction } from '@/core/entities/transaction';
import { toDateInput } from '@/shared/lib/local-day';
import type { TransactionCursor } from '@/shared/lib/transaction-cursor';

export interface TransactionPageInput {
  userId: string;
  /** What the list shows; paging fields in it are ignored. */
  filters: TransactionFilters;
  grouping: TransactionGrouping;
  /** Where the previous page ended. */
  cursor?: TransactionCursor;
  limit: number;
  now?: Date;
}

export interface TransactionPage {
  /** Newest first, up to the end of today. */
  transactions: Transaction[];
  /** Where the next page starts; null after the last one. */
  next: TransactionCursor | null;
  /**
   * What came in minus what went out in each group on this page, over all
   * of the group's rows — a day split between two pages still shows its
   * whole total.
   */
  totals: Record<string, number>;
}

/** The group a transaction is listed under, as `TransactionRepository#totalsBy` keys it. */
export function groupKeyOf(
  transaction: Transaction,
  grouping: TransactionGrouping,
): string {
  if (grouping === 'category') return transaction.categoryId ?? 'none';
  const day = toDateInput(transaction.occurredAt);
  return grouping === 'day' ? day : day.slice(0, 7);
}

function startOfGroup(date: Date, grouping: 'day' | 'month'): Date {
  return grouping === 'day'
    ? new Date(date.getFullYear(), date.getMonth(), date.getDate())
    : new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfGroup(date: Date, grouping: 'day' | 'month'): Date {
  return grouping === 'day'
    ? new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        23,
        59,
        59,
        999,
      )
    : new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function later(a: Date | undefined, b: Date): Date {
  return a && a > b ? a : b;
}

function earlier(a: Date | undefined, b: Date): Date {
  return a && a < b ? a : b;
}

/**
 * One page of the transaction list (spec 2026-10-17-inicio-hub-design.md
 * §5): what already happened, newest first, with the total of each day,
 * month or category on it. What is scheduled after today is listed apart
 * (`GetScheduledTransactionsUseCase`), so installments months ahead don't
 * open the list.
 */
export class GetTransactionPageUseCase {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async execute(input: TransactionPageInput): Promise<TransactionPage> {
    const { userId, grouping, limit } = input;
    const now = input.now ?? new Date();
    const filters: TransactionFilters = {
      ...input.filters,
      to: earlier(input.filters.to, endOfGroup(now, 'day')),
      cursor: undefined,
      page: undefined,
      pageSize: undefined,
    };
    if (filters.from && filters.to && filters.from > filters.to) {
      return { transactions: [], next: null, totals: {} };
    }

    const rows = await this.transactionRepository.findByUserId(userId, {
      ...filters,
      cursor: input.cursor,
      pageSize: limit + 1,
    });
    const transactions = rows.slice(0, limit);
    const newest = transactions[0];
    const oldest = transactions.at(-1);
    if (!newest || !oldest) return { transactions, next: null, totals: {} };

    const next =
      rows.length > limit
        ? { occurredAt: oldest.occurredAt, id: oldest.id }
        : null;

    // Days and months: only the span this page covers. Categories run
    // through the whole list.
    const span =
      grouping === 'category'
        ? filters
        : {
            ...filters,
            from: later(
              filters.from,
              startOfGroup(oldest.occurredAt, grouping),
            ),
            to: earlier(filters.to, endOfGroup(newest.occurredAt, grouping)),
          };
    const keys = new Set(
      transactions.map((transaction) => groupKeyOf(transaction, grouping)),
    );
    const totals: Record<string, number> = {};
    for (const total of await this.transactionRepository.totalsBy(
      userId,
      grouping,
      span,
    )) {
      if (keys.has(total.key)) {
        totals[total.key] =
          Math.round((total.income - total.expense) * 100) / 100;
      }
    }

    return { transactions, next, totals };
  }
}
