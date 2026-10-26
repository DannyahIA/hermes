import type { CategoryRow } from '@/modules/categories/application/get-categories-overview.use-case';
import { formatCurrency } from '@/shared/lib/format-currency';
import { toDateInput } from '@/shared/lib/local-day';

const MONTH_PARAM = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface Label {
  text: string;
  className: string;
}

/** "2026-10" for a date in local time. */
export function monthOf(date: Date): string {
  return toDateInput(date).slice(0, 7);
}

/**
 * The month a `?mes=` value names. A missing, malformed or future value
 * falls back to the current month.
 */
export function resolveMonth(value: string | undefined, now: Date): string {
  const current = monthOf(now);
  return value && MONTH_PARAM.test(value) && value <= current ? value : current;
}

/** The month `delta` months away: shiftMonth('2026-01', -1) is '2025-12'. */
export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return monthOf(new Date(year, monthNumber - 1 + delta, 1));
}

function monthDate(month: string): Date {
  return new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1);
}

/** "outubro de 2026", or "outubro" when `withYear` is false. */
export function monthName(month: string, withYear: boolean): string {
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {}),
  }).format(monthDate(month));
}

/** The name of `target` for a link next to `reference`: the year is added only when they differ. */
export function monthNameFrom(target: string, reference: string): string {
  return monthName(target, target.slice(0, 4) !== reference.slice(0, 4));
}

/** "mai", "jun": the three letters of a month, for a chart's axis. */
export function monthShortLabel(month: string): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'short' })
    .format(monthDate(month))
    .replace('.', '');
}

/** The six months that end with `month`, oldest first. */
export function lastSixMonths(month: string): string[] {
  return [-5, -4, -3, -2, -1, 0].map((delta) => shiftMonth(month, delta));
}

/** The first and last day of a month as `<input type="date">` values. */
export function monthRange(month: string): { from: string; to: string } {
  const last = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0,
  );
  return { from: `${month}-01`, to: toDateInput(last) };
}

/**
 * A change in whole percent. Spending going up is red and going down is
 * green; income is the other way round (`upIsGood`). Nothing to compare
 * against shows a dash.
 */
export function formatChange(
  deltaPercent: number | null,
  upIsGood = false,
): Label {
  if (deltaPercent === null) {
    return { text: '—', className: 'text-muted-foreground' };
  }
  if (deltaPercent === 0) {
    return { text: '0%', className: 'text-muted-foreground' };
  }
  const isUp = deltaPercent > 0;
  return {
    text: `${isUp ? '▲' : '▼'} ${Math.abs(deltaPercent)}%`,
    className: isUp === upIsGood ? 'text-success' : 'text-destructive',
  };
}

/** "83% de R$ 1.500,00", in red from 100% on; a dash without a budget. */
export function formatBudget(budget: CategoryRow['budget']): Label {
  if (!budget || budget.amount <= 0) {
    return { text: '—', className: 'text-muted-foreground' };
  }
  const percent = Math.round((budget.spent / budget.amount) * 100);
  return {
    text: `${percent}% de ${formatCurrency(budget.amount)}`,
    className: percent >= 100 ? 'text-destructive' : 'text-foreground',
  };
}

/** A share (0 to 1) as a whole percent: "24%". */
export function wholePercent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/** "1 compra", "18 compras". */
export function pluralize(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
