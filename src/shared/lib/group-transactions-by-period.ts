const WEEKDAY_NAMES = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

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

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.round(
    (startOfDay(a).getTime() - startOfDay(b).getTime()) / MS_PER_DAY,
  );
}

function labelFor(occurredAt: Date, today: Date): string {
  const dayDiff = daysBetween(today, occurredAt);

  if (dayDiff === 0) return 'Hoje';
  if (dayDiff === 1) return 'Ontem';
  if (dayDiff > 1 && dayDiff <= 7) return WEEKDAY_NAMES[occurredAt.getDay()];

  const sameMonth =
    occurredAt.getFullYear() === today.getFullYear() &&
    occurredAt.getMonth() === today.getMonth();
  if (sameMonth) return 'Este mês';

  return `${MONTH_NAMES[occurredAt.getMonth()]} de ${occurredAt.getFullYear()}`;
}

export interface TransactionGroup<T> {
  label: string;
  items: T[];
}

/**
 * Buckets a list of items with an `occurredAt` into WhatsApp-style temporal
 * groups: "Hoje" / "Ontem" / weekday name (last 7 days) / "Este mês" / "Mês
 * de Ano" for anything older. Assumes `items` is already sorted newest-first
 * (the same order the transaction list and its cursor pagination produce) —
 * groups are emitted in first-seen order, so an unsorted input would
 * interleave groups instead of erroring, which is why this precondition is
 * documented rather than enforced.
 */
export function groupTransactionsByPeriod<T extends { occurredAt: Date }>(
  items: T[],
  today: Date,
): TransactionGroup<T>[] {
  const groups: TransactionGroup<T>[] = [];
  const indexByLabel = new Map<string, number>();

  for (const item of items) {
    const label = labelFor(item.occurredAt, today);
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
