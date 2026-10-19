import type { TransactionFilters } from '@/core/contracts/transaction-repository';
import { toDateInput } from '@/shared/lib/local-day';
import {
  parseCategoryFilter,
  UNCATEGORIZED_FILTER,
} from '@/shared/lib/transaction-filters';

/**
 * The transaction list's filters as they travel in the address
 * (`/transactions?q=padaria&from=2026-10-01`). The page, the endpoint that
 * loads more rows and the CSV export all read them the same way.
 */
export interface TransactionQuery {
  q?: string;
  accountId?: string;
  /** A category id, or "none" for what still has no category. */
  categoryId?: string;
  type?: string;
  /** Calendar days: "2026-10-01". */
  from?: string;
  to?: string;
}

const KEYS = ['q', 'accountId', 'categoryId', 'type', 'from', 'to'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = new Set(['income', 'expense', 'transfer']);

type ParamSource =
  URLSearchParams | Record<string, string | string[] | undefined>;

function parseDay(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  return date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function isValid(key: (typeof KEYS)[number], value: string): boolean {
  switch (key) {
    case 'accountId':
      return UUID.test(value);
    case 'categoryId':
      return value === UNCATEGORIZED_FILTER || UUID.test(value);
    case 'type':
      return TYPES.has(value);
    case 'from':
    case 'to':
      return parseDay(value) !== null;
    default:
      return true;
  }
}

/**
 * Keeps what the list understands and drops the rest: an id that isn't
 * one, or a date that isn't a day, would only make the query fail.
 */
export function readTransactionQuery(source: ParamSource): TransactionQuery {
  const query: TransactionQuery = {};
  for (const key of KEYS) {
    const raw =
      source instanceof URLSearchParams ? source.get(key) : source[key];
    const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
    if (value && isValid(key, value)) query[key] = value;
  }
  return query;
}

export function toTransactionFilters(
  query: TransactionQuery,
): TransactionFilters {
  const filters: TransactionFilters = {
    ...parseCategoryFilter(query.categoryId),
  };
  if (query.q) filters.search = query.q;
  if (query.accountId) filters.accountId = query.accountId;
  if (query.type) filters.type = query.type as TransactionFilters['type'];
  const from = query.from ? parseDay(query.from) : null;
  const to = query.to ? parseDay(query.to) : null;
  if (from) filters.from = from;
  if (to) {
    to.setHours(23, 59, 59, 999);
    filters.to = to;
  }
  return filters;
}

/**
 * The query as a search string ("?q=…", or "" when empty), with `changes`
 * over it; a change to `undefined` removes that filter.
 */
export function transactionSearch(
  query: TransactionQuery,
  changes: Partial<TransactionQuery> = {},
): string {
  const next = { ...query, ...changes };
  const params = new URLSearchParams();
  for (const key of KEYS) {
    const value = next[key];
    if (value) params.set(key, value);
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

export type PeriodPreset = 'today' | 'last7' | 'thisMonth' | 'lastMonth';

export const PERIOD_PRESETS: Array<{ preset: PeriodPreset; label: string }> = [
  { preset: 'today', label: 'Hoje' },
  { preset: 'last7', label: '7 dias' },
  { preset: 'thisMonth', label: 'Este mês' },
  { preset: 'lastMonth', label: 'Mês passado' },
];

/** The whole days a shortcut covers. "Este mês" runs to its last day, so what is already scheduled in it shows too. */
export function periodRange(
  preset: PeriodPreset,
  today: Date,
): { from: string; to: string } {
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();
  switch (preset) {
    case 'today':
      return { from: toDateInput(today), to: toDateInput(today) };
    case 'last7':
      return {
        from: toDateInput(new Date(year, month, day - 6)),
        to: toDateInput(today),
      };
    case 'thisMonth':
      return {
        from: toDateInput(new Date(year, month, 1)),
        to: toDateInput(new Date(year, month + 1, 0)),
      };
    case 'lastMonth':
      return {
        from: toDateInput(new Date(year, month - 1, 1)),
        to: toDateInput(new Date(year, month, 0)),
      };
  }
}

/** Which shortcut the dates came from; "custom" for any other period, null for none. */
export function activePeriod(
  query: Pick<TransactionQuery, 'from' | 'to'>,
  today: Date,
): PeriodPreset | 'custom' | null {
  if (!query.from && !query.to) return null;
  const match = PERIOD_PRESETS.find(({ preset }) => {
    const range = periodRange(preset, today);
    return range.from === query.from && range.to === query.to;
  });
  return match?.preset ?? 'custom';
}

const dayMonth = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
});
const dayMonthYear = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** "1 a 15 de out.", "20 de set. a 15 de out.", "Desde 3 de out." */
export function describePeriod(
  query: Pick<TransactionQuery, 'from' | 'to'>,
  today: Date,
): string {
  const from = query.from ? parseDay(query.from) : null;
  const to = query.to ? parseDay(query.to) : null;
  const thisYear = today.getFullYear();
  const format = (date: Date) =>
    (date.getFullYear() === thisYear ? dayMonth : dayMonthYear).format(date);

  if (from && to) {
    if (from.getTime() === to.getTime()) return format(from);
    if (from.getFullYear() !== to.getFullYear()) {
      return `${dayMonthYear.format(from)} a ${dayMonthYear.format(to)}`;
    }
    const start =
      from.getMonth() === to.getMonth()
        ? String(from.getDate())
        : dayMonth.format(from);
    return `${start} a ${format(to)}`;
  }
  if (from) return `Desde ${format(from)}`;
  if (to) return `Até ${format(to)}`;
  return 'Todo o período';
}
