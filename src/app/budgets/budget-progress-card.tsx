import { DeleteBudgetButton } from '@/app/budgets/delete-budget-button';
import { formatCurrency } from '@/app/budgets/format-currency';
import { Card } from '@/components/ui/card';
import type { BudgetProgress } from '@/modules/budgets/application/get-budget-progress.use-case';

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

export function BudgetProgressCard({
  progress,
  categoryName,
  categoryColor,
}: BudgetProgressCardProps) {
  const { budget, spent, percentage } = progress;
  const clampedPercentage = Math.min(Math.max(percentage, 0), 1) * 100;

  return (
    <Card className="border-border/70 bg-card/80 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: categoryColor ?? '#94a3b8' }}
            aria-hidden
          />
          <div>
            <p className="text-lg font-semibold">{categoryName}</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {formatDate(budget.periodStart)} – {formatDate(budget.periodEnd)}
            </p>
          </div>
        </div>

        <DeleteBudgetButton id={budget.id} />
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="dimension-figure">
            {formatCurrency(spent, budget.currency)} de{' '}
            {formatCurrency(budget.amount, budget.currency)}
          </span>
          <span className="text-muted-foreground dimension-figure">
            {Math.round(percentage * 100)}%
          </span>
        </div>
        <div className="bg-muted h-1.5">
          <div
            className={`h-1.5 ${progressBarColor(percentage)}`}
            style={{ width: `${clampedPercentage}%` }}
          />
        </div>
      </div>
    </Card>
  );
}
