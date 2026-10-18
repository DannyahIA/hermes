import type { Account } from '@/core/entities/account';
import type { Transaction } from '@/core/entities/transaction';

import type { QuickEntryAccount } from './parse-quick-entry';

/**
 * The accounts a quick entry can go to — archived ones can't take entries —
 * each with how many expenses and incomes it took in `history`, so
 * `parseQuickEntry` can default to the one used most. Transfers and bill
 * payments don't count: they say nothing about where spending goes.
 */
export function quickEntryAccounts(
  accounts: Account[],
  history: Transaction[],
): QuickEntryAccount[] {
  const uses = new Map<string, QuickEntryAccount['uses']>();
  for (const transaction of history) {
    const type = transaction.countsAs('income')
      ? 'income'
      : transaction.countsAs('expense')
        ? 'expense'
        : null;
    if (!type) continue;
    const counts = uses.get(transaction.accountId) ?? { expense: 0, income: 0 };
    counts[type] += 1;
    uses.set(transaction.accountId, counts);
  }

  return accounts
    .filter((account) => !account.archived)
    .map((account) => ({
      id: account.id,
      name: account.name,
      type: account.type,
      uses: uses.get(account.id) ?? { expense: 0, income: 0 },
    }));
}
