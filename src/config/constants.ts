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

/**
 * Spacing scale referenced by ui-ux.md — kept here as the single source of
 * truth for any place that needs the raw pixel values (e.g. chart layout
 * math), while everyday styling should prefer Tailwind's spacing utilities.
 */
export const SPACING_SCALE = [4, 8, 12, 16, 24, 32, 48, 64] as const;

export const PAGE_SIZE = 20;
