import type { Transaction } from '@/core/entities/transaction';

import { resolveCategoryName, UNCATEGORIZED_KEY } from './category-key';

export type TrendDirection = 'subindo' | 'caindo' | 'estável' | 'insuficiente';

export interface CategoryTrendStats {
  categoryId: string;
  categoryName: string;
  average: number;
  median: number;
  trend: TrendDirection;
}

/** Below this slope (as a fraction of the mean, per month), call the series flat. */
const TREND_THRESHOLD = 0.05;

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

/**
 * Least-squares slope over the monthly totals, normalized by the mean so the
 * threshold means the same thing for a R$50 category and a R$5.000 one. Fewer
 * than two months is reported as `insuficiente` rather than guessed at — a
 * regression over a single point has no slope to measure.
 */
function classifyTrend(monthlyTotals: number[]): TrendDirection {
  if (monthlyTotals.length < 2) return 'insuficiente';

  const n = monthlyTotals.length;
  const xMean = (n - 1) / 2;
  const yMean = monthlyTotals.reduce((sum, v) => sum + v, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (monthlyTotals[i] - yMean);
    denominator += (i - xMean) ** 2;
  }
  const slope = denominator === 0 ? 0 : numerator / denominator;

  if (yMean === 0) {
    if (slope === 0) return 'estável';
    return slope > 0 ? 'subindo' : 'caindo';
  }

  const relativeSlope = slope / yMean;
  if (relativeSlope > TREND_THRESHOLD) return 'subindo';
  if (relativeSlope < -TREND_THRESHOLD) return 'caindo';
  return 'estável';
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Descriptive statistics over each category's monthly expense series —
 * average, median, and a direction. Deliberately plain arithmetic: no model,
 * no forecast, just what the recorded months already say.
 */
export function calculateTrendStats(
  transactions: Transaction[],
  categories: Array<{ id: string; name: string }>,
  period: { from: Date; to: Date },
): CategoryTrendStats[] {
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  // categoryId -> monthKey -> total
  const totalsByCategory = new Map<string, Map<string, number>>();

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue;
    if (transaction.occurredAt < period.from) continue;
    if (transaction.occurredAt > period.to) continue;

    const categoryId = transaction.categoryId ?? UNCATEGORIZED_KEY;
    const key = monthKey(transaction.occurredAt);
    const monthly =
      totalsByCategory.get(categoryId) ?? new Map<string, number>();
    monthly.set(key, (monthly.get(key) ?? 0) + transaction.amount);
    totalsByCategory.set(categoryId, monthly);
  }

  return [...totalsByCategory.entries()].map(([categoryId, monthly]) => {
    const monthlyTotals = [...monthly.values()];
    return {
      categoryId,
      categoryName: resolveCategoryName(categoryId, categoriesById),
      average:
        monthlyTotals.reduce((sum, v) => sum + v, 0) / monthlyTotals.length,
      median: median(monthlyTotals),
      trend: classifyTrend(monthlyTotals),
    };
  });
}
