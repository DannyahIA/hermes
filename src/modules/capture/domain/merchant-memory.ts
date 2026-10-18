import type { Transaction } from '@/core/entities/transaction';

import { normalizeMerchant } from './normalize-merchant';

/**
 * What the person did before at one merchant: the category it was filed
 * under, whether it was money in or out, and the account it went through.
 * Plain data, so a page can hand it to the browser and the quick entry can
 * fill these in while the person types.
 */
export interface MerchantMemoryEntry {
  /** `normalizeMerchant` key: "padaria real". */
  key: string;
  /** How it is written: the name a merchant rule keeps, or the one used most. */
  displayName?: string;
  categoryId?: string;
  type?: 'income' | 'expense';
  accountId?: string;
}

interface MerchantMemoryInput {
  rules: Array<{
    merchantKey: string;
    displayName: string;
    categoryId: string;
  }>;
  /** Recent transactions — the caller picks the window. */
  history: Transaction[];
  /** Categories that can still receive transactions. */
  categoryIds: string[];
  /** Accounts that can still receive transactions. */
  accountIds: string[];
}

type Tally = Map<string, { count: number; last: number }>;

function tally(tallies: Tally, value: string, at: Date) {
  const entry = tallies.get(value) ?? { count: 0, last: 0 };
  entry.count += 1;
  entry.last = Math.max(entry.last, at.getTime());
  tallies.set(value, entry);
}

/** Most used; on a tie, the most recently used. */
function top(tallies: Tally): string | undefined {
  return [...tallies.entries()].sort(
    ([, a], [, b]) => b.count - a.count || b.last - a.last,
  )[0]?.[0];
}

/**
 * One entry per merchant seen in `history` or named by a rule. A rule
 * decides the category and the name (it is what the person chose last);
 * otherwise the most used category and spelling win. Transfers and bill payments say
 * nothing about a merchant and are left out.
 */
export function buildMerchantMemory({
  rules,
  history,
  categoryIds,
  accountIds,
}: MerchantMemoryInput): MerchantMemoryEntry[] {
  const categories = new Set(categoryIds);
  const accounts = new Set(accountIds);
  const seen = new Map<
    string,
    { names: Tally; categories: Tally; types: Tally; accounts: Tally }
  >();

  for (const transaction of history) {
    const type = transaction.countsAs('income')
      ? 'income'
      : transaction.countsAs('expense')
        ? 'expense'
        : null;
    if (!type) continue;
    const { key, displayName } = normalizeMerchant(transaction.description);
    if (!key) continue;

    const merchant = seen.get(key) ?? {
      names: new Map(),
      categories: new Map(),
      types: new Map(),
      accounts: new Map(),
    };
    const at = transaction.occurredAt;
    tally(merchant.names, displayName, at);
    tally(merchant.types, type, at);
    if (transaction.categoryId && categories.has(transaction.categoryId)) {
      tally(merchant.categories, transaction.categoryId, at);
    }
    if (accounts.has(transaction.accountId)) {
      tally(merchant.accounts, transaction.accountId, at);
    }
    seen.set(key, merchant);
  }

  const ruleByKey = new Map(
    rules
      .filter((rule) => categories.has(rule.categoryId))
      .map((rule) => [rule.merchantKey, rule]),
  );

  const keys = new Set([...seen.keys(), ...ruleByKey.keys()]);
  const memory: MerchantMemoryEntry[] = [];
  for (const key of [...keys].sort()) {
    const merchant = seen.get(key);
    const rule = ruleByKey.get(key);
    const entry: MerchantMemoryEntry = { key };
    const displayName = rule?.displayName ?? (merchant && top(merchant.names));
    if (displayName) entry.displayName = displayName;
    const categoryId =
      rule?.categoryId ?? (merchant && top(merchant.categories));
    if (categoryId) entry.categoryId = categoryId;
    const type = merchant && top(merchant.types);
    if (type) entry.type = type as 'income' | 'expense';
    const accountId = merchant && top(merchant.accounts);
    if (accountId) entry.accountId = accountId;

    // An expense with nothing else known teaches nothing: expense is the
    // default anyway.
    if (entry.categoryId || entry.accountId || entry.type === 'income') {
      memory.push(entry);
    }
  }
  return memory;
}

/** The value every entry agrees on, if they all do. */
function agreed<T>(values: Array<T | undefined>): T | undefined {
  const distinct = new Set(values);
  return distinct.size === 1 ? values[0] : undefined;
}

/**
 * The merchant a description names. An exact match first; otherwise a
 * short name for a known one ("condor" for "Supermercado Condor"),
 * keeping only what every merchant with those words agrees on — "posto"
 * can say Transporte without saying which card, and "mercado" says
 * nothing about a category when Mercado Livre and Mercado Pago differ.
 */
export function recallMerchant(
  memory: MerchantMemoryEntry[],
  description: string,
): MerchantMemoryEntry | null {
  const { key } = normalizeMerchant(description);
  if (!key) return null;

  const exact = memory.find((entry) => entry.key === key);
  if (exact) return exact;
  if (key.length < 3) return null;

  const words = key.split(' ');
  const matches = memory.filter((entry) => {
    const entryWords = entry.key.split(' ');
    return words.every((word) => entryWords.includes(word));
  });
  if (matches.length === 0) return null;

  const recalled: MerchantMemoryEntry = { key };
  const categoryId = agreed(matches.map((entry) => entry.categoryId));
  if (categoryId) recalled.categoryId = categoryId;
  const type = agreed(matches.map((entry) => entry.type));
  if (type) recalled.type = type;
  const accountId = agreed(matches.map((entry) => entry.accountId));
  if (accountId) recalled.accountId = accountId;
  return Object.keys(recalled).length > 1 ? recalled : null;
}
