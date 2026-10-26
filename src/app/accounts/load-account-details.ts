import type { CardBills, RecentLine } from '@/app/accounts/account-row';
import type { AccountRepository } from '@/core/contracts/account-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import { GetCardStatementsUseCase } from '@/modules/dashboard/application/get-spending-snapshot.use-case';
import { formatDate } from '@/shared/lib/format-date';

export const RECENT_PER_ACCOUNT = 5;

export interface AccountDetails {
  recent: Record<string, RecentLine[]>;
  statements: Record<string, CardBills>;
}

/**
 * What an opened account shows: its last transactions (up to today) and,
 * for a card, its bills. Plain objects only, so the rows can be client
 * components.
 */
export async function loadAccountDetails(
  accountRepository: AccountRepository,
  transactionRepository: TransactionRepository,
  userId: string,
  accountIds: string[],
  now: Date,
): Promise<AccountDetails> {
  const [latest, cardStatements] = await Promise.all([
    Promise.all(
      accountIds.map((accountId) =>
        transactionRepository.findByUserId(userId, {
          accountId,
          to: now,
          pageSize: RECENT_PER_ACCOUNT,
        }),
      ),
    ),
    new GetCardStatementsUseCase(
      accountRepository,
      transactionRepository,
    ).execute(userId, now),
  ]);

  const recent: Record<string, RecentLine[]> = {};
  accountIds.forEach((accountId, index) => {
    recent[accountId] = latest[index].map((transaction) => ({
      id: transaction.id,
      description: transaction.description,
      amount: transaction.amount,
      type: transaction.type,
      occurredAt: transaction.occurredAt.toISOString(),
    }));
  });

  const statements: Record<string, CardBills> = {};
  for (const { accountId, cycle } of cardStatements) {
    if (!cycle) continue;
    statements[accountId] = {
      open: cycle.open,
      closed: cycle.closedUnpaid,
      dueLabel: formatDate(cycle.openDueOn),
    };
  }
  return { recent, statements };
}
