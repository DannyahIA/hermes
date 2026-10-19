import type { Transaction } from '@/core/entities/transaction';
import { normalizeMerchant } from '@/modules/capture/domain/normalize-merchant';

const DEFAULT_LIMIT = 3;

/** How far back the history behind a suggestion goes. */
export const SUGGESTION_HISTORY_DAYS = 90;

interface SuggesterInput {
  /** Categories that can still receive transactions (not archived). */
  categoryIds: string[];
  rules: Array<{ merchantKey: string; categoryId: string }>;
  /** Recently categorized transactions — the caller picks the window. */
  history: Transaction[];
}

type Tally = Map<string, { count: number; last: number }>;

function tally(tallies: Tally, categoryId: string, at: Date) {
  const entry = tallies.get(categoryId) ?? { count: 0, last: 0 };
  entry.count += 1;
  entry.last = Math.max(entry.last, at.getTime());
  tallies.set(categoryId, entry);
}

/** Most used first; on a tie, the most recently used. */
function ranked(tallies: Tally | undefined): string[] {
  if (!tallies) return [];
  return [...tallies.entries()]
    .sort(([, a], [, b]) => b.count - a.count || b.last - a.last)
    .map(([categoryId]) => categoryId);
}

/**
 * Builds a function that suggests categories for an uncategorized
 * transaction (spec 2026-10-17-inicio-hub-design.md §4.2), in this order:
 *
 *   1. the category remembered for the merchant (merchant_rules);
 *   2. the one used most for the same merchant before;
 *   3. the ones used most for this kind of transaction lately.
 *
 * Built once per screen so a list of transactions shares the tallies.
 * Shared with the Telegram capture, which offers the same suggestions as
 * buttons.
 */
export function createCategorySuggester({
  categoryIds,
  rules,
  history,
}: SuggesterInput) {
  const available = new Set(categoryIds);
  const ruleByKey = new Map(
    rules.map((rule) => [rule.merchantKey, rule.categoryId]),
  );
  const byMerchant = new Map<string, Tally>();
  const byType = new Map<Transaction['type'], Tally>();

  for (const transaction of history) {
    const { categoryId } = transaction;
    if (!categoryId || !available.has(categoryId)) continue;

    const { key } = normalizeMerchant(transaction.description);
    const merchantKey = `${transaction.type}:${key}`;
    if (key) {
      const merchant = byMerchant.get(merchantKey) ?? new Map();
      tally(merchant, categoryId, transaction.occurredAt);
      byMerchant.set(merchantKey, merchant);
    }

    const type = byType.get(transaction.type) ?? new Map();
    tally(type, categoryId, transaction.occurredAt);
    byType.set(transaction.type, type);
  }

  return function suggest(
    description: string,
    type: Transaction['type'],
    limit = DEFAULT_LIMIT,
  ): string[] {
    const { key } = normalizeMerchant(description);
    const fromRule = key ? ruleByKey.get(key) : undefined;
    const candidates = [
      ...(fromRule ? [fromRule] : []),
      ...ranked(key ? byMerchant.get(`${type}:${key}`) : undefined),
      ...ranked(byType.get(type)),
    ];

    const suggestions: string[] = [];
    for (const categoryId of candidates) {
      if (suggestions.length === limit) break;
      if (available.has(categoryId) && !suggestions.includes(categoryId)) {
        suggestions.push(categoryId);
      }
    }
    return suggestions;
  };
}
