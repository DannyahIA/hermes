import type { Account } from '@/core/entities/account';
import type { Transaction } from '@/core/entities/transaction';

export interface CardCycle {
  /** When the current statement opened (the last closing day). */
  lastClosing: Date;
  nextClosing: Date;
  /** Charged since the last closing, refunds taken off. */
  open: number;
  openDueOn: Date;
  /** What's still owed from the statement that closed on `lastClosing`. */
  closedUnpaid: number;
  closedDueOn: Date;
  /** The closed statement's due date has passed with money still owed on it. */
  overdue: boolean;
}

export interface CardStatement {
  accountId: string;
  name: string;
  /** Everything owed on the card today. */
  owed: number;
  /** Null when the card has no closing/due day to derive a cycle from. */
  cycle: CardCycle | null;
}

function cycleDate(year: number, month: number, day: number): Date {
  return new Date(year, month, day);
}

/**
 * The due date of the statement that closes on `closing`: the due day in
 * the same month when it comes after the closing day, otherwise the next.
 */
function dueDateFor(closing: Date, closingDay: number, dueDay: number): Date {
  return cycleDate(
    closing.getFullYear(),
    closing.getMonth() + (dueDay > closingDay ? 0 : 1),
    dueDay,
  );
}

/**
 * Each visible card's statement, derived the same way Account#nextDueDate
 * is — Hermes never stores a bill (spec 2026-10-17-inicio-hub-design.md
 * §4.3). A statement runs from one closing day (inclusive — a purchase on
 * closing day already goes to the next bill) to the next. Whatever is owed
 * beyond the open statement is what's left of the closed one, assuming
 * payments settle the oldest debt first.
 */
export function calculateCardStatements(
  balances: Array<{ account: Account; currentBalance: number }>,
  transactions: Transaction[],
  today: Date,
): CardStatement[] {
  const endOfToday = cycleDate(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1,
  );

  return balances
    .filter(
      ({ account }) =>
        account.type === 'credit' && !account.hidden && !account.archived,
    )
    .map(({ account, currentBalance }) => {
      const owed = Math.max(0, currentBalance);
      const { closingDay, dueDay } = account;
      if (!closingDay || !dueDay) {
        return {
          accountId: account.id,
          name: account.name,
          owed,
          cycle: null,
        };
      }

      const closesThisMonth = today.getDate() >= closingDay;
      const lastClosing = cycleDate(
        today.getFullYear(),
        today.getMonth() - (closesThisMonth ? 0 : 1),
        closingDay,
      );
      const nextClosing = cycleDate(
        lastClosing.getFullYear(),
        lastClosing.getMonth() + 1,
        closingDay,
      );

      const open = transactions
        .filter(
          (t) =>
            t.accountId === account.id &&
            t.occurredAt >= lastClosing &&
            t.occurredAt < endOfToday,
        )
        .reduce(
          (sum, t) =>
            t.type === 'expense'
              ? sum + t.amount
              : t.type === 'income'
                ? sum - t.amount
                : sum,
          0,
        );

      const closedUnpaid = Math.max(0, owed - Math.max(0, open));
      const closedDueOn = dueDateFor(lastClosing, closingDay, dueDay);

      return {
        accountId: account.id,
        name: account.name,
        owed,
        cycle: {
          lastClosing,
          nextClosing,
          open,
          openDueOn: dueDateFor(nextClosing, closingDay, dueDay),
          closedUnpaid,
          closedDueOn,
          overdue: closedUnpaid >= 0.005 && closedDueOn < today,
        },
      };
    });
}
