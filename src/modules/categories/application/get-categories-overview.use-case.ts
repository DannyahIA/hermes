import type { BudgetRepository } from '@/core/contracts/budget-repository';
import type { CategoryRepository } from '@/core/contracts/category-repository';
import type { MerchantRuleRepository } from '@/core/contracts/merchant-rule-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import type { Category } from '@/core/entities/category';
import type { Transaction } from '@/core/entities/transaction';
import {
  type BudgetProgress,
  GetBudgetProgressUseCase,
} from '@/modules/budgets/application/get-budget-progress.use-case';
import { normalizeMerchant } from '@/modules/capture/domain/normalize-merchant';

import type { NewCategoryHint } from '../domain/category-catalog';
import {
  cents,
  chronological,
  daysBefore,
  inWindow,
  type MonthWindow,
  monthWindows,
  percentChange,
  totalOf,
} from './month-totals';
import { suggestNewCategories } from './suggest-new-categories';

/** How far back the read goes, when that is further than the six months: the archive check needs the last 60 days. */
const HISTORY_DAYS = 90;
/** A category unused this long is suggested for archiving. */
const UNUSED_DAYS = 60;
/** Look-alike names need at least this many letters on the shorter one. */
const MERGE_MIN_LETTERS = 4;
const TOP_MERCHANTS = 3;

export interface CategoryRow {
  id: string;
  name: string;
  color?: string;
  /** The month's spending; in `incomeRows`, the month's income. */
  spent: number;
  count: number;
  /** Share of the month's total (0 to 1). */
  share: number;
  previous: number;
  /** Change from the month before, in whole percent; null when that was 0. */
  deltaPercent: number | null;
  /** Only the budget that covers the month. */
  budget: { spent: number; amount: number } | null;
  /** Six totals, oldest first, ending with the month. */
  months: number[];
  topMerchants: Array<{ name: string; total: number }>;
}

export interface CategoriesOverview {
  month: string;
  previousMonth: string;
  spent: number;
  previousSpent: number;
  deltaPercent: number | null;
  /** The month's spending with no category. */
  uncategorized: number;
  rows: CategoryRow[];
  incomeRows: CategoryRow[];
  archived: Array<{ id: string; name: string; color?: string }>;
  suggestions: {
    create: Array<{
      key: string;
      name: string;
      color: string;
      transactionIds: string[];
      total: number;
    }>;
    archive: Array<{ categoryId: string; name: string }>;
    merge: Array<{
      keepId: string;
      keepName: string;
      mergeId: string;
      mergeName: string;
      mergeCount: number;
    }>;
  };
}

/** The transactions of one side (spending or income) across the read window. */
interface Side {
  entries: Transaction[];
  /** The month's total for this side: the denominator of `share`. */
  monthTotal: number;
  /** Six months, oldest first; the last one is the selected month. */
  windows: MonthWindow[];
}

function byName<T extends { name: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name, 'pt-BR');
}

/** Most spent first; categories with nothing spent end up last, by name. */
function byRowOrder(a: CategoryRow, b: CategoryRow): number {
  return b.spent - a.spent || byName(a, b);
}

function inWindowOf(transactions: Transaction[], window: MonthWindow) {
  return transactions.filter((t) => inWindow(window, t.occurredAt));
}

function withoutTrailingS(key: string): string {
  return key.endsWith('s') ? key.slice(0, -1) : key;
}

function letterCount(key: string): number {
  return key.replace(/\s/g, '').length;
}

/**
 * Two category names that look like one category: the same merchant key,
 * the same once one trailing "s" is dropped ("Mercados" and "Mercado"), or
 * one inside the other with at least four letters ("Mercado" and
 * "Supermercado"). A name with no letters matches nothing.
 */
function looksAlike(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b || withoutTrailingS(a) === b || a === withoutTrailingS(b)) {
    return true;
  }
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return letterCount(shorter) >= MERGE_MIN_LETTERS && longer.includes(shorter);
}

function lookAlikePairs(categories: Category[]): Array<[Category, Category]> {
  const keys = categories.map((c) => normalizeMerchant(c.name).key);
  const pairs: Array<[Category, Category]> = [];
  for (let i = 0; i < categories.length; i += 1) {
    for (let j = i + 1; j < categories.length; j += 1) {
      if (looksAlike(keys[i], keys[j])) {
        pairs.push([categories[i], categories[j]]);
      }
    }
  }
  return pairs;
}

/** The busier category stays; on a tie, the one created first. */
function keepAndMerge(
  a: Category,
  b: Category,
  counts: Map<string, number>,
): [keep: Category, merge: Category] {
  const countA = counts.get(a.id) ?? 0;
  const countB = counts.get(b.id) ?? 0;
  if (countA !== countB) return countA > countB ? [a, b] : [b, a];
  return a.props.createdAt <= b.props.createdAt ? [a, b] : [b, a];
}

/** The category's budget that covers the month; the latest-starting one when several do. */
function budgetFor(
  categoryId: string,
  progress: BudgetProgress[],
  current: MonthWindow,
): CategoryRow['budget'] {
  const covering = progress
    .filter(
      ({ budget }) =>
        budget.categoryId === categoryId &&
        budget.periodStart < current.end &&
        budget.periodEnd >= current.start,
    )
    .sort(
      (a, b) => b.budget.periodStart.getTime() - a.budget.periodStart.getTime(),
    );
  const latest = covering[0];
  if (!latest) return null;
  return {
    spent: cents(latest.spent),
    amount: cents(latest.budget.amount),
  };
}

/** Up to three merchants of the month, by total. Each merchant is named as it was most recently written. */
function topMerchantsOf(
  transactions: Transaction[],
): CategoryRow['topMerchants'] {
  const groups = new Map<string, { name: string; total: number }>();
  for (const transaction of chronological(transactions).reverse()) {
    const { key, displayName } = normalizeMerchant(transaction.description);
    const groupKey = key || transaction.description.trim();
    const group = groups.get(groupKey) ?? { name: displayName, total: 0 };
    group.total += transaction.amount;
    groups.set(groupKey, group);
  }
  return [...groups.values()]
    .map(({ name, total }) => ({ name, total: cents(total) }))
    .sort((a, b) => b.total - a.total || byName(a, b))
    .slice(0, TOP_MERCHANTS);
}

function buildRow(
  category: Category,
  side: Side,
  budget: CategoryRow['budget'],
): CategoryRow {
  const own = side.entries.filter((t) => t.categoryId === category.id);
  const thisMonth = inWindowOf(own, side.windows[side.windows.length - 1]);
  const spent = totalOf(thisMonth);
  const previous = totalOf(
    inWindowOf(own, side.windows[side.windows.length - 2]),
  );
  return {
    id: category.id,
    name: category.name,
    color: category.color,
    spent,
    count: thisMonth.length,
    share: side.monthTotal > 0 ? spent / side.monthTotal : 0,
    previous,
    deltaPercent: percentChange(spent, previous),
    budget,
    months: side.windows.map((window) => totalOf(inWindowOf(own, window))),
    topMerchants: topMerchantsOf(thisMonth),
  };
}

/** Groups the new-category hints by catalog key, in the order the purchases happened. */
function newCategorySuggestions(
  transactions: Transaction[],
  hints: Record<string, NewCategoryHint>,
): CategoriesOverview['suggestions']['create'] {
  const groups = new Map<
    string,
    { hint: NewCategoryHint; transactions: Transaction[] }
  >();
  for (const transaction of chronological(transactions)) {
    const hint = hints[transaction.id];
    if (!hint) continue;
    const group = groups.get(hint.key) ?? { hint, transactions: [] };
    group.transactions.push(transaction);
    groups.set(hint.key, group);
  }
  return [...groups.values()]
    .map(({ hint, transactions: grouped }) => ({
      key: hint.key,
      name: hint.name,
      color: hint.color,
      transactionIds: grouped.map((t) => t.id),
      total: totalOf(grouped),
    }))
    .sort((a, b) => b.total - a.total || byName(a, b));
}

/**
 * Categories created 60 days ago or more, with no transaction in the last
 * 60 days and no budget still running. A running budget means the
 * category is meant to be used.
 */
function archiveSuggestions(
  active: Category[],
  transactions: Transaction[],
  progress: BudgetProgress[],
  now: Date,
): CategoriesOverview['suggestions']['archive'] {
  const cutoff = daysBefore(now, UNUSED_DAYS);
  const usedRecently = new Set(
    transactions
      .filter((t) => t.occurredAt >= cutoff && t.occurredAt <= now)
      .map((t) => t.categoryId),
  );
  const running = new Set(
    progress
      .filter(({ budget }) => budget.periodEnd >= now)
      .map(({ budget }) => budget.categoryId),
  );
  return active
    .filter(
      (c) =>
        c.props.createdAt <= cutoff &&
        !usedRecently.has(c.id) &&
        !running.has(c.id),
    )
    .map((c) => ({ categoryId: c.id, name: c.name }))
    .sort(byName);
}

export class GetCategoriesOverviewUseCase {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly merchantRuleRepository: MerchantRuleRepository,
    private readonly budgetRepository: BudgetRepository,
  ) {}

  /**
   * What the Categorias screen shows for one month: the spending per
   * category against the month before, the income-only categories, the
   * archived ones and the tidy-up suggestions. Reads the transactions once,
   * from the start of the six months (or 90 days back, if earlier) to the
   * end of the month or now, whichever is later.
   */
  async execute(input: {
    userId: string;
    month: string;
    now?: Date;
  }): Promise<CategoriesOverview> {
    const windows = monthWindows(input.month);
    const current = windows[windows.length - 1];
    const previous = windows[windows.length - 2];
    const now = input.now ?? new Date();
    const from = new Date(
      Math.min(
        windows[0].start.getTime(),
        daysBefore(now, HISTORY_DAYS).getTime(),
      ),
    );
    const to = new Date(Math.max(current.end.getTime() - 1, now.getTime()));

    const [transactions, categories, rules, progress] = await Promise.all([
      this.transactionRepository.findByUserId(input.userId, {
        from,
        to,
        // Every row of the window, not the repository's first page.
        pageSize: 10_000,
      }),
      this.categoryRepository.findByUserId(input.userId),
      this.merchantRuleRepository.findByUserId(input.userId),
      new GetBudgetProgressUseCase(
        this.budgetRepository,
        this.transactionRepository,
      ).execute(input.userId),
    ]);

    const expenses = transactions.filter((t) => t.countsAs('expense'));
    const incomes = transactions.filter((t) => t.countsAs('income'));
    const spent = totalOf(inWindowOf(expenses, current));
    const previousSpent = totalOf(inWindowOf(expenses, previous));
    const incomeTotal = totalOf(inWindowOf(incomes, current));
    const expenseSide: Side = {
      entries: expenses,
      monthTotal: spent,
      windows,
    };
    const incomeSide: Side = {
      entries: incomes,
      monthTotal: incomeTotal,
      windows,
    };

    const active = categories.filter((c) => !c.archived);
    const spentIds = new Set(expenses.map((t) => t.categoryId));
    const earnedIds = new Set(incomes.map((t) => t.categoryId));
    const incomeOnly = (c: Category) =>
      earnedIds.has(c.id) && !spentIds.has(c.id);

    return {
      month: input.month,
      previousMonth: previous.key,
      spent,
      previousSpent,
      deltaPercent: percentChange(spent, previousSpent),
      uncategorized: totalOf(
        inWindowOf(expenses, current).filter((t) => !t.categoryId),
      ),
      rows: active
        .filter((c) => !incomeOnly(c))
        .map((c) =>
          buildRow(c, expenseSide, budgetFor(c.id, progress, current)),
        )
        .sort(byRowOrder),
      incomeRows: active
        .filter(incomeOnly)
        .map((c) => buildRow(c, incomeSide, null))
        .sort(byRowOrder),
      archived: categories
        .filter((c) => c.archived)
        .map((c) => ({ id: c.id, name: c.name, color: c.color }))
        .sort(byName),
      suggestions: {
        create: newCategorySuggestions(
          transactions,
          suggestNewCategories({ transactions, categories, rules }),
        ),
        archive: archiveSuggestions(active, transactions, progress, now),
        merge: await this.mergeSuggestions(input.userId, active),
      },
    };
  }

  /**
   * Look-alike pairs among the active categories, each counted in full
   * (every transaction, all time: what the merge would move). Each category
   * appears in at most one suggestion, taking the busiest pairs first.
   */
  private async mergeSuggestions(
    userId: string,
    active: Category[],
  ): Promise<CategoriesOverview['suggestions']['merge']> {
    const pairs = lookAlikePairs(active);
    if (pairs.length === 0) return [];

    const involved = [...new Set(pairs.flat())];
    const counts = new Map<string, number>(
      await Promise.all(
        involved.map(
          async (category) =>
            [
              category.id,
              (
                await this.transactionRepository.findByUserId(userId, {
                  categoryId: category.id,
                  pageSize: 10_000,
                })
              ).length,
            ] as [string, number],
        ),
      ),
    );

    const ranked = pairs
      .map(([a, b]) => {
        const [keep, merge] = keepAndMerge(a, b, counts);
        return {
          keep,
          merge,
          keepCount: counts.get(keep.id) ?? 0,
          mergeCount: counts.get(merge.id) ?? 0,
        };
      })
      .sort(
        (x, y) =>
          y.keepCount - x.keepCount ||
          byName(x.keep, y.keep) ||
          byName(x.merge, y.merge),
      );

    const taken = new Set<string>();
    const suggestions: CategoriesOverview['suggestions']['merge'] = [];
    for (const { keep, merge, mergeCount } of ranked) {
      if (taken.has(keep.id) || taken.has(merge.id)) continue;
      taken.add(keep.id);
      taken.add(merge.id);
      suggestions.push({
        keepId: keep.id,
        keepName: keep.name,
        mergeId: merge.id,
        mergeName: merge.name,
        mergeCount,
      });
    }
    return suggestions;
  }
}
