export interface CategoryGroup<T> {
  label: string;
  items: T[];
}

const UNCATEGORIZED_LABEL = 'Sem categoria';

/** Groups items by `categoryName` (falling back to "Sem categoria" when
 * `categoryId` is unset), ranked by each group's total `amount` descending
 * — the biggest-spend category first, matching how a "gastos por
 * categoria" view is naturally scanned. The uncategorized group always
 * sorts last, regardless of its total, since it isn't a real category to
 * rank against the others. */
export function groupTransactionsByCategory<
  T extends { categoryId?: string; categoryName?: string; amount: number },
>(items: T[]): CategoryGroup<T>[] {
  const groupsByLabel = new Map<string, T[]>();

  for (const item of items) {
    const label = item.categoryId
      ? (item.categoryName ?? UNCATEGORIZED_LABEL)
      : UNCATEGORIZED_LABEL;
    const group = groupsByLabel.get(label) ?? [];
    group.push(item);
    groupsByLabel.set(label, group);
  }

  const groups = Array.from(groupsByLabel.entries()).map(
    ([label, groupItems]) => ({
      label,
      items: groupItems,
      total: groupItems.reduce((sum, item) => sum + item.amount, 0),
    }),
  );

  groups.sort((a, b) => {
    if (a.label === UNCATEGORIZED_LABEL) return 1;
    if (b.label === UNCATEGORIZED_LABEL) return -1;
    return b.total - a.total;
  });

  return groups.map(({ label, items: groupItems }) => ({
    label,
    items: groupItems,
  }));
}
