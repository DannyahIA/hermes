import type { Transaction } from '@/core/entities/transaction';

/** Total income or spending — card bill payments excluded (see Transaction#isCardBillPayment). */
export function sumByType(
  transactions: Transaction[],
  type: 'income' | 'expense',
): number {
  return transactions
    .filter((t) => t.countsAs(type))
    .reduce((sum, t) => sum + t.amount, 0);
}
