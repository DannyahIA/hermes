import type { Account } from '@/core/entities/account';
import type { Transaction } from '@/core/entities/transaction';

export interface NetWorthPoint {
  month: Date;
  netWorth: number;
}

export function netWorthFetchRange(
  period: { from: Date; to: Date },
  now: Date = new Date(),
): { from: Date; to: Date } {
  return {
    from: new Date(period.from.getFullYear(), period.from.getMonth(), 1),
    to: period.to < now ? period.to : now,
  };
}

function isIncomeOrExpense(
  transaction: Transaction,
): transaction is Transaction & { type: 'income' | 'expense' } {
  return transaction.type === 'income' || transaction.type === 'expense';
}

/**
 * Net worth is never stored — it is reconstructed by starting at each
 * account's current balance and walking backward one calendar month at a
 * time, subtracting that month's net income/expense effect. Transfers net
 * to zero across a user's own accounts, so they're excluded.
 */
export function calculateNetWorthByMonth(
  accounts: Account[],
  transactions: Transaction[],
  period: { from: Date; to: Date },
  now: Date = new Date(),
): NetWorthPoint[] {
  const visibleAccounts = accounts.filter((account) => !account.hidden);
  const accountsById = new Map(
    visibleAccounts.map((account) => [account.id, account]),
  );
  const { from: rangeStart, to: periodEnd } = netWorthFetchRange(period, now);

  let runningNetWorth = visibleAccounts.reduce(
    (sum, account) => sum + account.balance,
    0,
  );

  const points: NetWorthPoint[] = [];
  const cursor = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1);

  while (cursor >= rangeStart) {
    points.unshift({ month: new Date(cursor), netWorth: runningNetWorth });

    const monthEffect = transactions
      .filter(isIncomeOrExpense)
      .filter(
        (t) =>
          t.occurredAt.getFullYear() === cursor.getFullYear() &&
          t.occurredAt.getMonth() === cursor.getMonth() &&
          accountsById.has(t.accountId),
      )
      .reduce((sum, t) => {
        const account = accountsById.get(t.accountId);
        return account ? sum + account.deltaFor(t.type, t.amount) : sum;
      }, 0);

    runningNetWorth -= monthEffect;
    cursor.setMonth(cursor.getMonth() - 1);
  }

  return points;
}
