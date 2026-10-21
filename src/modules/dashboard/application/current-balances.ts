import type { AccountRepository } from '@/core/contracts/account-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import type { Account } from '@/core/entities/account';
import type { Transaction } from '@/core/entities/transaction';
import { computeCurrentBalance } from '@/core/value-objects/current-balance';

export interface CurrentBalances {
  balances: Array<{ account: Account; currentBalance: number }>;
  /** Transactions dated after today (materialized installments). */
  futureTransactions: Transaction[];
}

/**
 * Each account's balance today: the stored balance already counts the
 * installments still to come, which are taken back out here — the same
 * way the Início reads it.
 */
export async function loadCurrentBalances(
  accountRepository: AccountRepository,
  transactionRepository: TransactionRepository,
  userId: string,
  now: Date,
): Promise<CurrentBalances> {
  const tomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  const [accounts, futureTransactions] = await Promise.all([
    accountRepository.findByUserId(userId),
    transactionRepository.findByUserId(userId, {
      from: tomorrow,
      pageSize: 10_000,
    }),
  ]);

  const futureByAccount = new Map<string, Transaction[]>();
  for (const transaction of futureTransactions) {
    const list = futureByAccount.get(transaction.accountId) ?? [];
    list.push(transaction);
    futureByAccount.set(transaction.accountId, list);
  }

  return {
    balances: accounts.map((account) => ({
      account,
      currentBalance: computeCurrentBalance(
        account.balance,
        futureByAccount.get(account.id) ?? [],
        account,
      ),
    })),
    futureTransactions,
  };
}
