'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { ChartTooltipContent } from '@/components/ui/chart-tooltip';
import type { CategorySpending } from '@/modules/reports/application/metrics/calculate-category-spending';
import {
  CHART_CATEGORICAL_COLORS,
  CHART_OTHER_COLOR,
  CHART_OTHER_LABEL,
} from '@/shared/constants/chart-colors';
import { formatCurrency } from '@/shared/lib/format-currency';
import { splitPastLimit } from '@/shared/lib/split-past-limit';

interface CategorySpendingChartProps {
  categories: CategorySpending[];
}

const MAX_SLICES = CHART_CATEGORICAL_COLORS.length;

function foldIntoSlices(categories: CategorySpending[]) {
  const { head, tail } = splitPastLimit(categories, MAX_SLICES);
  const slicedHead = head.map((category, index) => ({
    ...category,
    color: CHART_CATEGORICAL_COLORS[index],
  }));

  if (tail.length === 0) return slicedHead;

  return [
    ...slicedHead,
    {
      categoryId: 'other',
      categoryName: CHART_OTHER_LABEL,
      total: tail.reduce((sum, category) => sum + category.total, 0),
      color: CHART_OTHER_COLOR,
    },
  ];
}

/**
 * Part-to-whole across categories, so unlike every other chart here the
 * slices need categorical identity rather than a single status hue. The
 * legend always prints the amount as text beside its swatch — three of the
 * light-mode palette slots sit under 3:1 contrast on this surface, so color
 * never carries the value alone.
 */
export function CategorySpendingChart({
  categories,
}: CategorySpendingChartProps) {
  if (categories.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nenhuma despesa registrada neste período.
      </p>
    );
  }

  const slices = foldIntoSlices(categories);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="h-48 w-full sm:w-48 sm:shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="total"
              nameKey="categoryName"
              innerRadius="60%"
              outerRadius="90%"
            >
              {slices.map((slice) => (
                <Cell
                  key={slice.categoryId}
                  fill={slice.color}
                  stroke="var(--card)"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltipContent />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {slices.map((slice) => (
          <li
            key={slice.categoryId}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              <span className="truncate">{slice.categoryName}</span>
            </span>
            <span className="dimension-figure shrink-0 font-semibold">
              {formatCurrency(slice.total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
