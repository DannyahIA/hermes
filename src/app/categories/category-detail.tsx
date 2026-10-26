import Link from 'next/link';

import {
  formatBudget,
  lastSixMonths,
  monthRange,
  monthShortLabel,
  wholePercent,
} from '@/app/categories/category-display';
import { CategoryMonthChart } from '@/app/categories/category-month-chart';
import type { CategoryRow } from '@/modules/categories/application/get-categories-overview.use-case';
import { cn } from '@/shared/lib/cn';
import { formatCurrency } from '@/shared/lib/format-currency';

interface CategoryDetailProps {
  row: CategoryRow;
  side: 'expense' | 'income';
  month: string;
}

/** Where the money went for one category: its top merchants, six months, and the transactions behind it. */
export function CategoryDetail({ row, side, month }: CategoryDetailProps) {
  const months = lastSixMonths(month);
  const budget = formatBudget(row.budget);
  const range = monthRange(month);
  const linkLabel =
    row.count === 1 ? 'Ver a 1 transação' : `Ver as ${row.count} transações`;

  return (
    <div className="bg-muted/40 border-border rounded-lg border p-4">
      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h3 className="text-sm font-medium">
            {side === 'income' ? 'Onde mais recebeu' : 'Onde mais gastou'}
          </h3>
          {row.topMerchants.length === 0 ? (
            <p className="text-muted-foreground mt-2 text-sm">
              Nenhuma transação neste mês.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm">
              {row.topMerchants.map((merchant) => (
                <li
                  key={merchant.name}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="truncate">{merchant.name}</span>
                  <span className="dimension-figure shrink-0">
                    {formatCurrency(merchant.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="text-sm font-medium">Últimos seis meses</h3>
          <div className="mt-2">
            <CategoryMonthChart
              values={row.months}
              labels={months.map(monthShortLabel)}
              color={row.color}
            />
          </div>
        </section>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
        <p className="text-muted-foreground">
          Do total:{' '}
          <span className="text-foreground dimension-figure">
            {wholePercent(row.share)}
          </span>
          {row.budget && (
            <>
              {' · '}Orçamento:{' '}
              <span className={cn('dimension-figure', budget.className)}>
                {budget.text}
              </span>
            </>
          )}
        </p>
        {row.count > 0 && (
          <Link
            href={`/transactions?categoryId=${row.id}&from=${range.from}&to=${range.to}`}
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            {linkLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
