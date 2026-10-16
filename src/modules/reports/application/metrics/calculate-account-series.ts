import type { Account } from '@/core/entities/account';
import type { Transaction } from '@/core/entities/transaction';
import {
  buildMonthlyCashFlow,
  type MonthlyCashFlow,
} from '@/shared/lib/build-monthly-cash-flow';

import {
  calculateNetWorthByMonth,
  type NetWorthPoint,
} from './calculate-net-worth-by-month';

export interface AccountSeries {
  accountId: string;
  accountName: string;
  balanceByMonth: NetWorthPoint[];
  cashFlowByMonth: MonthlyCashFlow[];
}

/**
 * The same balance reconstruction the consolidated net worth does, but one
 * account at a time, plus that account's own monthly income/expense. Hidden
 * accounts are dropped entirely (not zeroed) — the same rule net worth
 * applies, so a hidden account never shows up as an empty row either.
 */
export function calculateAccountSeries(
  accounts: Account[],
  transactions: Transaction[],
  period: { from: Date; to: Date },
  now: Date = new Date(),
): AccountSeries[] {
  return accounts
    .filter((account) => !account.hidden)
    .map((account) => {
      const accountTransactions = transactions.filter(
        (t) => t.accountId === account.id,
      );
      return {
        accountId: account.id,
        accountName: account.name,
        balanceByMonth: calculateNetWorthByMonth(
          [account],
          accountTransactions,
          period,
          now,
        ),
        cashFlowByMonth: buildMonthlyCashFlow(
          period.from,
          period.to,
          accountTransactions,
        ),
      };
    });
}
