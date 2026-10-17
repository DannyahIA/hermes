import type { TransactionFilters } from '@/core/contracts/transaction-repository';

/** The `categoryId` query value that asks for transactions with no category. */
export const UNCATEGORIZED_FILTER = 'none';

/**
 * Reads the category filter from a query string: a category id, or
 * "none" for what still needs one (see TransactionFilters#uncategorized).
 */
export function parseCategoryFilter(
  value: string | null | undefined,
): Pick<TransactionFilters, 'categoryId' | 'uncategorized'> {
  if (!value) return {};
  if (value === UNCATEGORIZED_FILTER) return { uncategorized: true };
  return { categoryId: value };
}
