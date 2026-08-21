/**
 * App-wide constants that aren't secrets and don't change per-environment.
 */
export const APP_NAME = 'Hermes';
export const APP_DESCRIPTION = 'Sua central de comando financeira.';

export const DEFAULT_CURRENCY = 'BRL';

export const ACCOUNT_TYPES = ['checking', 'savings', 'credit'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Conta corrente',
  savings: 'Poupança',
  credit: 'Cartão de crédito',
};

export const TRANSACTION_TYPES = ['income', 'expense', 'transfer'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  income: 'Receita',
  expense: 'Despesa',
  transfer: 'Transferência',
};

export type TransactionViewMode =
  'chronological' | 'grouped_by_category' | 'grouped_by_month';

export const VIEW_MODE_LABELS: Record<TransactionViewMode, string> = {
  chronological: 'Cronológico',
  grouped_by_category: 'Por categoria',
  grouped_by_month: 'Por mês',
};

/** The full set of valid modes — the single source of truth other modules
 * (e.g. `preferences-actions.ts`'s validation, `page.tsx`'s read-side guard)
 * reuse instead of redefining the union. Kept in this plain (non `'use
 * client'`) module so it's safely importable from Server Components/Actions
 * — importing it from a `'use client'` module instead would make Next's
 * flight loader replace it with a throwing client-reference stub on the
 * server. */
export const TRANSACTION_VIEW_MODES = Object.keys(
  VIEW_MODE_LABELS,
) as TransactionViewMode[];

/**
 * Spacing scale referenced by ui-ux.md — kept here as the single source of
 * truth for any place that needs the raw pixel values (e.g. chart layout
 * math), while everyday styling should prefer Tailwind's spacing utilities.
 */
export const SPACING_SCALE = [4, 8, 12, 16, 24, 32, 48, 64] as const;

export const PAGE_SIZE = 20;
