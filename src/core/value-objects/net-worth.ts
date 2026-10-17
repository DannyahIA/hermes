import type { Account } from '@/core/entities/account';
import type { Transaction } from '@/core/entities/transaction';

/**
 * What an account's balance adds to net worth. Cash accounts count for it;
 * a credit card's balance is what is owed (see Account#deltaFor), so it
 * counts against it. The single place this rule lives — every net worth
 * figure (dashboard, reports, PDF) goes through it.
 */
export function netWorthContribution(
  account: Pick<Account, 'type'>,
  balance: number,
): number {
  return account.type === 'credit' ? -balance : balance;
}

export interface BalanceEffect {
  accountId: string;
  /** Change to the account's stored balance, in that account's own terms (debt for a card). */
  delta: number;
}

/**
 * How a transaction moved stored account balances, so a balance can be
 * walked backward through time by undoing it:
 *
 * - income/expense: its own account, by Account#deltaFor;
 * - a card bill payment: the paying account loses the amount *and* the
 *   card's debt drops by it — PayCreditCardBillUseCase adjusts the card
 *   directly, with no transaction row of its own;
 * - a transfer: nothing. Its row doesn't record which leg it is (see
 *   computeCurrentBalance), and across the user's own accounts it nets to
 *   zero anyway.
 *
 * Accounts missing from `accountsById` (hidden, or not the user's) are
 * skipped.
 */
export function balanceEffects(
  transaction: Transaction,
  accountsById: ReadonlyMap<string, Account>,
): BalanceEffect[] {
  if (transaction.type === 'transfer') return [];

  const effects: BalanceEffect[] = [];
  const account = accountsById.get(transaction.accountId);
  if (account) {
    effects.push({
      accountId: account.id,
      delta: account.deltaFor(transaction.type, transaction.amount),
    });
  }

  const settledCard = transaction.settlesAccountId
    ? accountsById.get(transaction.settlesAccountId)
    : undefined;
  if (settledCard) {
    effects.push({ accountId: settledCard.id, delta: -transaction.amount });
  }

  return effects;
}
