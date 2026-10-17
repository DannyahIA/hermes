import type { Account } from '@/core/entities/account';
import type { Transaction } from '@/core/entities/transaction';
import { computeCurrentBalance } from '@/core/value-objects/current-balance';
import {
  balanceEffects,
  netWorthContribution,
} from '@/core/value-objects/net-worth';

export interface NetWorthPoint {
  month: Date;
  netWorth: number;
}

/**
 * The transactions the reconstruction needs: everything from the first
 * month shown, with no upper bound. The walk starts from today's balance,
 * so it has to see every month after the period too — and the
 * future-dated transactions, to take them back out of the stored balance.
 */
export function netWorthFetchRange(period: { from: Date }): { from: Date } {
  return {
    from: new Date(period.from.getFullYear(), period.from.getMonth(), 1),
  };
}

function startOfTomorrow(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

function monthIndex(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth();
}

/**
 * Today's balance — the stored one already includes every future-dated
 * installment (see computeCurrentBalance).
 */
function currentBalanceOf(
  account: Account,
  transactions: Transaction[],
  now: Date,
): number {
  const tomorrow = startOfTomorrow(now);
  return computeCurrentBalance(
    account.balance,
    transactions.filter(
      (t) => t.accountId === account.id && t.occurredAt >= tomorrow,
    ),
    account,
  );
}

/**
 * Starts from `today` and walks backward one calendar month at a time,
 * undoing each month's effect. Months after `period.to` are walked through
 * but not emitted, so a past period ends on its own balance, not today's.
 */
function walkBackByMonth(
  today: number,
  transactions: Transaction[],
  effectOf: (transaction: Transaction) => number,
  period: { from: Date; to: Date },
  now: Date,
): NetWorthPoint[] {
  const tomorrow = startOfTomorrow(now);
  const effectByMonth = new Map<number, number>();
  for (const transaction of transactions) {
    if (transaction.occurredAt >= tomorrow) continue;
    const key = monthIndex(transaction.occurredAt);
    effectByMonth.set(
      key,
      (effectByMonth.get(key) ?? 0) + effectOf(transaction),
    );
  }

  const firstMonth = monthIndex(period.from);
  const lastMonth = monthIndex(period.to < now ? period.to : now);
  const points: NetWorthPoint[] = [];
  let running = today;

  for (let month = monthIndex(now); month >= firstMonth; month--) {
    if (month <= lastMonth) {
      points.unshift({
        month: new Date(Math.floor(month / 12), month % 12, 1),
        netWorth: running,
      });
    }
    running -= effectByMonth.get(month) ?? 0;
  }

  return points;
}

/**
 * Net worth is never stored — it is reconstructed from today's, walking
 * backward through each month's balance effects (see balanceEffects): a
 * card purchase lowers it like any expense, a bill payment leaves it
 * unchanged, and transfers between the user's own accounts net to zero.
 * A credit card's balance counts against it (see netWorthContribution).
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

  const today = visibleAccounts.reduce(
    (sum, account) =>
      sum +
      netWorthContribution(
        account,
        currentBalanceOf(account, transactions, now),
      ),
    0,
  );

  const netWorthEffect = (transaction: Transaction) => {
    let effect = 0;
    for (const { accountId, delta } of balanceEffects(
      transaction,
      accountsById,
    )) {
      const account = accountsById.get(accountId);
      if (account) effect += netWorthContribution(account, delta);
    }
    return effect;
  };

  return walkBackByMonth(today, transactions, netWorthEffect, period, now);
}

/**
 * One account's own balance by month, in that account's terms — what is
 * owed, for a credit card. `transactions` must include the bill payments
 * that settle it, which live on the paying account.
 */
export function calculateBalanceByMonth(
  account: Account,
  transactions: Transaction[],
  period: { from: Date; to: Date },
  now: Date = new Date(),
): NetWorthPoint[] {
  const accountsById = new Map([[account.id, account]]);

  const balanceEffect = (transaction: Transaction) =>
    balanceEffects(transaction, accountsById).reduce(
      (sum, { delta }) => sum + delta,
      0,
    );

  return walkBackByMonth(
    currentBalanceOf(account, transactions, now),
    transactions,
    balanceEffect,
    period,
    now,
  );
}
