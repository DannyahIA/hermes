import { Fragment, useId } from 'react';

import { CategoryDetail } from '@/app/categories/category-detail';
import {
  formatBudget,
  formatChange,
  pluralize,
  wholePercent,
} from '@/app/categories/category-display';
import { CategoryRowMenu } from '@/app/categories/category-row-menu';
import { CategoryDot } from '@/app/dashboard/category-picker';
import type { CategoryRow } from '@/modules/categories/application/get-categories-overview.use-case';
import { cn } from '@/shared/lib/cn';
import { formatCurrency } from '@/shared/lib/format-currency';

interface CategoryTableRowProps {
  row: CategoryRow;
  side: 'expense' | 'income';
  month: string;
  open: boolean;
  onToggle: (id: string) => void;
}

/**
 * One category in the list: a row of figures, and below it, when opened,
 * the detail. The name is the button that opens it, so the keyboard and
 * screen readers reach it like any disclosure.
 */
export function CategoryTableRow({
  row,
  side,
  month,
  open,
  onToggle,
}: CategoryTableRowProps) {
  const detailId = useId();
  const change = formatChange(row.deltaPercent, side === 'income');
  const budget = formatBudget(row.budget);

  return (
    <Fragment>
      <tr className="border-border border-b">
        <th scope="row" className="py-3 pl-4 text-left font-normal">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={open ? detailId : undefined}
            onClick={() => onToggle(row.id)}
            className="focus-visible:ring-ring flex items-center gap-2 rounded-sm text-left focus-visible:ring-2 focus-visible:outline-none"
          >
            <CategoryDot color={row.color} />
            <span className="font-medium">{row.name}</span>
            <span className="text-muted-foreground text-xs">
              {pluralize(row.count, 'compra', 'compras')}
            </span>
          </button>
        </th>
        <td className="dimension-figure py-3 pl-2 text-right whitespace-nowrap">
          {formatCurrency(row.spent)}
        </td>
        <td className="dimension-figure hidden py-3 pl-2 text-right sm:table-cell">
          {wholePercent(row.share)}
        </td>
        <td className="py-3 pl-2 text-right">
          <span
            className={cn(
              'dimension-figure whitespace-nowrap',
              change.className,
            )}
          >
            {change.text}
          </span>
        </td>
        <td className="hidden py-3 pl-2 text-right md:table-cell">
          <span
            className={cn(
              'dimension-figure whitespace-nowrap',
              budget.className,
            )}
          >
            {budget.text}
          </span>
        </td>
        <td className="py-2 pr-2 pl-1 text-right">
          <CategoryRowMenu
            id={row.id}
            name={row.name}
            color={row.color}
            archived={false}
          />
        </td>
      </tr>
      {open && (
        <tr id={detailId}>
          <td colSpan={6} className="px-4 pb-4">
            <CategoryDetail row={row} side={side} month={month} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}
