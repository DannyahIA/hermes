import type { TransactionGrouping } from '@/core/contracts/transaction-repository';
import { formatDayHeading, formatMonthHeading } from '@/shared/lib/format-date';

import { type ListedTransaction, takesCategory } from './listed-transaction';

/** Where transfers and card bill payments go when grouping by category. */
export const BETWEEN_ACCOUNTS = 'between';

export interface TransactionGroup {
  key: string;
  label: string;
  /** The category's color, when grouping by category. */
  color?: string;
  /** In minus out over the whole group, when known. */
  total?: number;
  rows: ListedTransaction[];
}

/**
 * The list's rows under their day, month or category heading. Days and
 * months come in the order the rows do (newest first, or soonest first
 * for what is scheduled); categories by how much moved in each, with what
 * has no category, then what only moved between the user's own accounts,
 * at the end.
 */
export function groupListedTransactions(
  rows: ListedTransaction[],
  grouping: TransactionGrouping,
  totals: Record<string, number>,
  today: string,
  categoriesById: Map<string, { name: string; color?: string }>,
): TransactionGroup[] {
  const groups = new Map<string, TransactionGroup>();
  for (const row of rows) {
    let key: string;
    let label: string;
    let color: string | undefined;
    if (grouping === 'day') {
      key = row.day;
      label = formatDayHeading(row.day, today);
    } else if (grouping === 'month') {
      key = row.day.slice(0, 7);
      label = formatMonthHeading(key);
    } else if (!takesCategory(row)) {
      key = BETWEEN_ACCOUNTS;
      label = 'Transferências e faturas';
    } else if (row.categoryId) {
      const category = categoriesById.get(row.categoryId);
      key = row.categoryId;
      label = category?.name ?? 'Categoria removida';
      color = category?.color;
    } else {
      key = 'none';
      label = 'Sem categoria';
    }
    const group = groups.get(key) ?? {
      key,
      label,
      color,
      total: totals[key],
      rows: [],
    };
    group.rows.push(row);
    groups.set(key, group);
  }

  const list = [...groups.values()];
  if (grouping !== 'category') return list;
  const rank = (group: TransactionGroup) =>
    group.key === BETWEEN_ACCOUNTS ? 2 : group.key === 'none' ? 1 : 0;
  return list.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      Math.abs(b.total ?? 0) - Math.abs(a.total ?? 0) ||
      a.label.localeCompare(b.label, 'pt-BR'),
  );
}
