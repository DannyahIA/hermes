import type { Account } from '@/core/entities/account';
import type { RecurringTransaction } from '@/core/entities/recurring-transaction';
import type { Transaction } from '@/core/entities/transaction';
import { occurrencesToGenerate } from '@/core/value-objects/recurrence';

import type { CardStatement } from './calculate-card-statements';

export interface UpcomingItem {
  date: Date;
  description: string;
  accountName: string;
  amount: number;
  type: 'income' | 'expense';
  kind: 'recurring' | 'installment' | 'scheduled' | 'card-bill';
  /** A card bill whose statement hasn't closed yet, so it can still grow. */
  partial?: boolean;
  /** A closed card bill past its due date. */
  overdue?: boolean;
}

export interface Upcoming {
  items: UpcomingItem[];
  totalOut: number;
  totalIn: number;
}

interface UpcomingInput {
  balances: Array<{ account: Account }>;
  recurringRules: RecurringTransaction[];
  /** Transactions dated after today (materialized installments). */
  futureTransactions: Transaction[];
  cardStatements: CardStatement[];
  today: Date;
  days?: number;
}

/**
 * What comes in and goes out over the next `days` (spec
 * 2026-10-17-inicio-hub-design.md §4.5): recurring rules projected
 * forward — they're only materialized when due, so they'd otherwise never
 * show ahead of time — installments already on the calendar, and card
 * bills on their due dates. An overdue bill leads the list.
 */
export function calculateUpcoming({
  balances,
  recurringRules,
  futureTransactions,
  cardStatements,
  today,
  days = 30,
}: UpcomingInput): Upcoming {
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const end = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + days + 1,
  );
  const visible = new Map(
    balances
      .filter(({ account }) => !account.hidden && !account.archived)
      .map(({ account }) => [account.id, account]),
  );
  const items: UpcomingItem[] = [];

  for (const rule of recurringRules) {
    const account = visible.get(rule.accountId);
    if (!rule.active || !account) continue;
    for (const date of occurrencesToGenerate(
      rule.props,
      new Date(end.getTime() - 1),
    )) {
      if (date < startOfToday) continue;
      items.push({
        date,
        description: rule.description,
        accountName: account.name,
        amount: rule.amount,
        type: rule.type,
        kind: 'recurring',
      });
    }
  }

  for (const transaction of futureTransactions) {
    const account = visible.get(transaction.accountId);
    if (!account || transaction.occurredAt >= end) continue;
    const type = transaction.countsAs('income')
      ? 'income'
      : transaction.countsAs('expense')
        ? 'expense'
        : null;
    if (!type) continue;
    items.push({
      date: transaction.occurredAt,
      description: transaction.description,
      accountName: account.name,
      amount: transaction.amount,
      type,
      kind: transaction.installmentPlanId ? 'installment' : 'scheduled',
    });
  }

  for (const { name, cycle } of cardStatements) {
    if (!cycle) continue;
    if (
      cycle.closedUnpaid >= 0.005 &&
      (cycle.overdue || cycle.closedDueOn >= startOfToday)
    ) {
      items.push({
        date: cycle.closedDueOn,
        description: `Fatura ${name}`,
        accountName: name,
        amount: cycle.closedUnpaid,
        type: 'expense',
        kind: 'card-bill',
        partial: false,
        overdue: cycle.overdue,
      });
    }
    if (cycle.open >= 0.005 && cycle.openDueOn < end) {
      items.push({
        date: cycle.openDueOn,
        description: `Fatura ${name}`,
        accountName: name,
        amount: cycle.open,
        type: 'expense',
        kind: 'card-bill',
        partial: true,
      });
    }
  }

  items.sort((a, b) => a.date.getTime() - b.date.getTime());

  return {
    items,
    totalOut: items
      .filter((item) => item.type === 'expense')
      .reduce((sum, item) => sum + item.amount, 0),
    totalIn: items
      .filter((item) => item.type === 'income')
      .reduce((sum, item) => sum + item.amount, 0),
  };
}
