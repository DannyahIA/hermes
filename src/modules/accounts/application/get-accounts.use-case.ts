import type { AccountRepository } from '@/core/contracts/account-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import type { Account } from '@/core/entities/account';
import { computeCurrentBalance } from '@/core/value-objects/current-balance';

export interface AccountWithBalances {
  account: Account;
  currentBalance: number;
  projectedBalance: number;
}

function startOfTomorrow(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);
  return date;
}

/**
 * Returns every account the user owns, each paired with its current
 * balance (excludes not-yet-occurred transactions, e.g. future installments)
 * and its projected balance (the stored balance as-is — see
 * `computeCurrentBalance`'s doc comment for why the stored value already
 * *is* the projection).
 */
export class GetAccountsUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly transactionRepository: TransactionRepository,
  ) {}

  async execute(userId: string): Promise<AccountWithBalances[]> {
    const accounts = await this.accountRepository.findByUserId(userId);

    const futureTransactions = await this.transactionRepository.findByUserId(
      userId,
      {
        from: startOfTomorrow(),
        pageSize: 10_000,
      },
    );
    const futureByAccountId = new Map<string, typeof futureTransactions>();
    for (const transaction of futureTransactions) {
      const list = futureByAccountId.get(transaction.accountId) ?? [];
      list.push(transaction);
      futureByAccountId.set(transaction.accountId, list);
    }

    return accounts.map((account) => {
      const future = futureByAccountId.get(account.id) ?? [];
      return {
        account,
        projectedBalance: account.balance,
        currentBalance: computeCurrentBalance(account.balance, future, account),
      };
    });
  }
}
