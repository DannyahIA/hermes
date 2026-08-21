import type { Account } from '@/core/entities/account';

export interface FutureTransactionEffect {
  type: 'income' | 'expense' | 'transfer';
  amount: number;
}

/**
 * Hermes materializes every installment of a purchase/loan as a real,
 * future-dated `Transaction` at creation time (see
 * `CreateInstallmentPlanUseCase`), applying its balance delta immediately.
 * That means the stored `account.balance` already reflects every known
 * future commitment — it is, in effect, the *projected* balance, not the
 * balance "right now". This function derives the true current balance by
 * reversing the effect of every transaction dated after today.
 *
 * Transfer legs are reversed by unconditionally subtracting `amount` —
 * matching `DeleteTransactionUseCase`'s existing convention, since a
 * transfer transaction row doesn't record which leg (debit/credit) it is.
 * This is a known, pre-existing limitation this function does not attempt
 * to fix (see the spec's "Limitação conhecida").
 */
export function computeCurrentBalance(
  storedBalance: number,
  futureTransactions: FutureTransactionEffect[],
  account: Pick<Account, 'deltaFor'>,
): number {
  const futureEffect = futureTransactions.reduce((sum, transaction) => {
    const delta =
      transaction.type === 'transfer'
        ? transaction.amount
        : account.deltaFor(transaction.type, transaction.amount);
    return sum + delta;
  }, 0);

  return storedBalance - futureEffect;
}
