import type { Account } from '@/core/entities/account';
import type { RecurringTransaction } from '@/core/entities/recurring-transaction';
import type { Transaction } from '@/core/entities/transaction';
import { occurrencesToGenerate } from '@/core/value-objects/recurrence';

export interface AvailableToSpend {
  /** The day the money has to last until: the next income, or the month's last day. */
  horizon: Date;
  horizonKind: 'income' | 'month-end';
  /** The recurring income that sets the horizon, e.g. "Salário". */
  incomeDescription?: string;
  inChecking: number;
  owedOnCards: number;
  /** Expenses already scheduled before the horizon: installments and recurring bills. */
  scheduled: number;
  free: number;
  /** Days, from today, the money has to cover. */
  daysLeft: number;
  /** `free` spread over `daysLeft`; null once it's zero or less. */
  perDay: number | null;
}

interface AvailableToSpendInput {
  balances: Array<{ account: Account; currentBalance: number }>;
  recurringRules: RecurringTransaction[];
  /** Transactions dated after today (materialized installments). */
  futureTransactions: Transaction[];
  today: Date;
}

const INCOME_LOOKAHEAD_DAYS = 45;
const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Upcoming occurrences of a rule from `from` (inclusive) to `until`
 * (exclusive) that haven't been materialized as transactions yet.
 */
function upcomingOccurrences(
  rule: RecurringTransaction,
  from: Date,
  until: Date,
): Date[] {
  return occurrencesToGenerate(
    rule.props,
    new Date(until.getTime() - 1),
  ).filter((date) => date >= from);
}

/**
 * How much of the checking balance is still free to spend before the next
 * income (spec 2026-10-17-inicio-hub-design.md §4.1): what's in checking,
 * minus everything owed on cards today (spending on credit is spending
 * now), minus the expenses already scheduled before the money comes in.
 *
 * Savings are reserve, not spending money, so they're left out. Returns
 * null without a visible checking account to spend from.
 */
export function calculateAvailableToSpend({
  balances,
  recurringRules,
  futureTransactions,
  today,
}: AvailableToSpendInput): AvailableToSpend | null {
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const tomorrow = addDays(startOfToday, 1);
  const visible = balances.filter(
    ({ account }) => !account.hidden && !account.archived,
  );
  const checking = visible.filter(({ account }) => account.type === 'checking');
  if (checking.length === 0) return null;

  const visibleIds = new Set(visible.map(({ account }) => account.id));
  const checkingIds = new Set(checking.map(({ account }) => account.id));
  const activeRules = recurringRules.filter(
    (rule) => rule.active && visibleIds.has(rule.accountId),
  );

  const nextIncome = activeRules
    .filter((rule) => rule.type === 'income' && checkingIds.has(rule.accountId))
    .flatMap((rule) =>
      upcomingOccurrences(
        rule,
        tomorrow,
        addDays(startOfToday, INCOME_LOOKAHEAD_DAYS + 1),
      ).map((date) => ({ date, description: rule.description })),
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

  const horizon =
    nextIncome?.date ?? new Date(today.getFullYear(), today.getMonth() + 1, 0);
  // An income horizon is the day the money arrives, so it no longer has to
  // cover that day; the month's last day still does.
  const windowEnd = nextIncome ? horizon : addDays(horizon, 1);

  const scheduledInstallments = futureTransactions
    .filter(
      (t) =>
        t.countsAs('expense') &&
        visibleIds.has(t.accountId) &&
        t.occurredAt < windowEnd,
    )
    .reduce((sum, t) => sum + t.amount, 0);
  const scheduledRecurring = activeRules
    .filter((rule) => rule.type === 'expense')
    .reduce(
      (sum, rule) =>
        sum +
        upcomingOccurrences(rule, startOfToday, windowEnd).length * rule.amount,
      0,
    );

  const inChecking = checking.reduce(
    (sum, { currentBalance }) => sum + currentBalance,
    0,
  );
  const owedOnCards = visible
    .filter(({ account }) => account.type === 'credit')
    .reduce((sum, { currentBalance }) => sum + Math.max(0, currentBalance), 0);
  const scheduled = scheduledInstallments + scheduledRecurring;
  const free = inChecking - owedOnCards - scheduled;
  const daysLeft = Math.max(
    1,
    Math.round((windowEnd.getTime() - startOfToday.getTime()) / DAY_MS),
  );

  return {
    horizon,
    horizonKind: nextIncome ? 'income' : 'month-end',
    incomeDescription: nextIncome?.description,
    inChecking,
    owedOnCards,
    scheduled,
    free,
    daysLeft,
    perDay: free > 0 ? free / daysLeft : null,
  };
}
