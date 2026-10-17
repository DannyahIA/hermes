import type { Transaction } from '@/core/entities/transaction';

export interface RecentDay {
  /** Local midnight of the day. */
  date: Date;
  /** What came in minus what went out that day, across every transaction on it. */
  net: number;
  transactions: Transaction[];
}

function dayKey(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

/**
 * The latest transactions grouped under their day, newest first (spec
 * 2026-10-17-inicio-hub-design.md §4.6). A day's total counts every
 * transaction on it in `sameDays` — not just the ones listed, which stop
 * at the list's limit — and leaves out transfers and card bill payments,
 * which move money between the user's own accounts.
 */
export function groupRecentByDay(
  recent: Transaction[],
  sameDays: Transaction[],
): RecentDay[] {
  const days = new Map<number, RecentDay>();
  for (const transaction of recent) {
    const key = dayKey(transaction.occurredAt);
    const day = days.get(key) ?? {
      date: new Date(key),
      net: 0,
      transactions: [],
    };
    day.transactions.push(transaction);
    days.set(key, day);
  }

  for (const transaction of sameDays) {
    const day = days.get(dayKey(transaction.occurredAt));
    if (!day) continue;
    if (transaction.countsAs('income')) day.net += transaction.amount;
    if (transaction.countsAs('expense')) day.net -= transaction.amount;
  }

  return [...days.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
}
