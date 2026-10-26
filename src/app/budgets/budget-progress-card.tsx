import { DeleteBudgetButton } from '@/app/budgets/delete-budget-button';
import { formatCurrency } from '@/app/budgets/format-currency';
import type { BudgetProgress } from '@/modules/budgets/application/get-budget-progress.use-case';
import { formatPercent } from '@/shared/lib/format-percent';

interface BudgetProgressCardProps {
  progress: BudgetProgress;
  categoryName: string;
  categoryColor?: string;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

function progressBarColor(percentage: number): string {
  if (percentage > 1) return 'bg-destructive';
  if (percentage >= 0.8) return 'bg-warning';
  return 'bg-primary';
}

/** One budget as a row of the budgets list: whose, how far along, how much. */
export function BudgetProgressCard({
  progress,
  categoryName,
  categoryColor,
}: BudgetProgressCardProps) {
  const { budget, amount, spent, percentage } = progress;
  const clampedPercentage = Math.min(Math.max(percentage, 0), 1) * 100;

  return (
    <li className="grid gap-x-6 gap-y-2 px-4 py-3.5 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{
            backgroundColor: categoryColor ?? 'var(--faint-foreground)',
          }}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="truncate font-medium" title={categoryName}>
            {categoryName}
          </p>
          <p className="text-muted-foreground text-xs">
            {formatDate(progress.period.start)} –{' '}
            {formatDate(progress.period.end)}
          </p>
        </div>
      </div>

      <div className="min-w-0">
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
          <span className="dimension-figure whitespace-nowrap">
            {formatCurrency(spent, budget.currency)}{' '}
            <span className="text-muted-foreground">
              de {formatCurrency(amount, budget.currency)}
            </span>
          </span>
          <span className="text-muted-foreground dimension-figure">
            {formatPercent(percentage * 100)}
          </span>
        </div>
        <div
          aria-hidden
          className="bg-muted h-1.5 overflow-hidden rounded-full"
        >
          <div
            className={`h-full rounded-full ${progressBarColor(percentage)}`}
            style={{ width: `${clampedPercentage}%` }}
          />
        </div>
      </div>

      <div className="justify-self-start sm:justify-self-end">
        <DeleteBudgetButton id={budget.id} />
      </div>
    </li>
  );
}
