import type { CSSProperties } from 'react';

import { wholePercent } from '@/app/categories/category-display';
import type { CategoryRow } from '@/modules/categories/application/get-categories-overview.use-case';
import { cn } from '@/shared/lib/cn';

/** The biggest categories get a slice of their own; the rest share "Outras". */
const TOP = 5;
/** Below half a cent a slice is rounding dust, not money. */
const EPSILON = 0.005;

interface Slice {
  key: string;
  label: string;
  value: number;
  color?: string;
  kind: 'category' | 'other' | 'uncategorized';
}

interface CategoryShareBarProps {
  rows: CategoryRow[];
  /** The month's spending: the whole bar. */
  spent: number;
  /** Spending with no category, shown as its own neutral slice. */
  uncategorized: number;
}

/**
 * The slices of the month's spending: the top categories, "Outras" for
 * the rest (archived categories included, since their spending is in the
 * total but not in the rows), and "Sem categoria" last.
 */
function sliceSpending(
  rows: CategoryRow[],
  spent: number,
  uncategorized: number,
): Slice[] {
  const top = rows
    .filter((row) => row.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, TOP);
  const topTotal = top.reduce((sum, row) => sum + row.spent, 0);
  const others = Math.max(0, spent - topTotal - uncategorized);

  const slices: Slice[] = top.map((row) => ({
    key: row.id,
    label: row.name,
    value: row.spent,
    color: row.color,
    kind: 'category',
  }));
  if (others >= EPSILON) {
    slices.push({
      key: 'others',
      label: 'Outras',
      value: others,
      kind: 'other',
    });
  }
  if (uncategorized >= EPSILON) {
    slices.push({
      key: 'uncategorized',
      label: 'Sem categoria',
      value: uncategorized,
      kind: 'uncategorized',
    });
  }
  return slices;
}

/** The fill of a slice: its category color, or a muted tone that is not a color of its own. */
function fillOf(slice: Slice): { className?: string; style?: CSSProperties } {
  if (slice.kind === 'uncategorized') {
    return {
      style: {
        backgroundImage:
          'repeating-linear-gradient(135deg, var(--muted-foreground) 0 2px, transparent 2px 5px)',
      },
    };
  }
  if (slice.kind === 'other') {
    return { className: 'bg-muted-foreground/30' };
  }
  if (slice.color) {
    return { style: { backgroundColor: slice.color } };
  }
  return { className: 'bg-muted-foreground/60' };
}

/**
 * The month's spending as one stacked bar, with a legend under it. The
 * bar is an image for screen readers, which get the same numbers from the
 * legend's list.
 */
export function CategoryShareBar({
  rows,
  spent,
  uncategorized,
}: CategoryShareBarProps) {
  if (spent <= 0) {
    return (
      <p className="text-muted-foreground text-sm">Nenhum gasto neste mês.</p>
    );
  }

  const slices = sliceSpending(rows, spent, uncategorized);
  const summary = slices
    .map((slice) => `${slice.label} ${wholePercent(slice.value / spent)}`)
    .join(', ');

  return (
    <div className="space-y-2">
      <div
        role="img"
        aria-label={`Gasto do mês por categoria: ${summary}.`}
        className="flex h-3 w-full overflow-hidden rounded-full"
      >
        {slices.map((slice) => {
          const fill = fillOf(slice);
          return (
            <span
              key={slice.key}
              className={cn('h-full', fill.className)}
              style={{
                width: `${(slice.value / spent) * 100}%`,
                ...fill.style,
              }}
            />
          );
        })}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {slices.map((slice) => {
          const fill = fillOf(slice);
          return (
            <li key={slice.key} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn('size-2.5 shrink-0 rounded-full', fill.className)}
                style={fill.style}
              />
              <span>{slice.label}</span>
              <span className="dimension-figure text-muted-foreground">
                {wholePercent(slice.value / spent)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
