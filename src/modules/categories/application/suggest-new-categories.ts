import type { Category } from '@/core/entities/category';
import type { Transaction } from '@/core/entities/transaction';
import { normalizeMerchant } from '@/modules/capture/domain/normalize-merchant';

import {
  catalogCategoryFor,
  type NewCategoryHint,
  sameCategoryName,
} from '../domain/category-catalog';

interface SuggestNewCategoriesInput {
  /** The transactions on screen; only uncategorized expenses are considered. */
  transactions: Transaction[];
  /** Every category the user has, archived ones too. */
  categories: Category[];
  /** Merchant rules: a merchant that has one already has its category. */
  rules: Array<{ merchantKey: string }>;
}

/**
 * Suggests a common category the user does not have yet for each
 * uncategorized expense whose merchant is in the catalog (spec
 * 2026-10-19-contas-planejamento-categorias-design.md §5.1), keyed by
 * transaction id. Skips a merchant with a rule, and a category the user
 * already has, archived or not. Income is skipped: a catalog word on a
 * refund would file it under a spending category.
 */
export function suggestNewCategories({
  transactions,
  categories,
  rules,
}: SuggestNewCategoriesInput): Record<string, NewCategoryHint> {
  const ruledMerchants = new Set(rules.map((rule) => rule.merchantKey));
  const suggestions: Record<string, NewCategoryHint> = {};

  for (const transaction of transactions) {
    if (
      transaction.categoryId ||
      !transaction.takesCategory ||
      transaction.type !== 'expense'
    ) {
      continue;
    }
    const { key } = normalizeMerchant(transaction.description);
    if (!key || ruledMerchants.has(key)) continue;

    const catalog = catalogCategoryFor(transaction.description);
    if (!catalog) continue;
    const hasIt = categories.some((category) =>
      sameCategoryName(category.name, catalog.name),
    );
    if (hasIt) continue;

    suggestions[transaction.id] = {
      key: catalog.key,
      name: catalog.name,
      color: catalog.color,
    };
  }
  return suggestions;
}
