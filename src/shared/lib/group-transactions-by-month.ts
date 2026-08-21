const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export interface MonthGroup<T> {
  label: string;
  items: T[];
}

/** Groups items by calendar month, labeled "Mês de Ano". Assumes `items`
 * is already sorted newest-first (same precondition as Round 1's
 * `groupTransactionsByPeriod`) — groups emit in first-seen order. */
export function groupTransactionsByMonth<T extends { occurredAt: Date }>(
  items: T[],
): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = [];
  const indexByLabel = new Map<string, number>();

  for (const item of items) {
    const label = `${MONTH_NAMES[item.occurredAt.getMonth()]} de ${item.occurredAt.getFullYear()}`;
    const existingIndex = indexByLabel.get(label);

    if (existingIndex === undefined) {
      indexByLabel.set(label, groups.length);
      groups.push({ label, items: [item] });
    } else {
      groups[existingIndex].items.push(item);
    }
  }

  return groups;
}
