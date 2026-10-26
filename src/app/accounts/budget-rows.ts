import type { BudgetRowProps } from '@/app/budgets/budget-row';
import type { BudgetProgress } from '@/modules/budgets/application/get-budget-progress.use-case';
import { projectedLimitDay } from '@/modules/budgets/domain/budget-alerts';
import { calculateBudgetPace } from '@/modules/dashboard/application/metrics/calculate-budget-pace';
import { formatCurrency } from '@/shared/lib/format-currency';

interface CategoryLook {
  name: string;
  color?: string;
}

function dayAndMonth(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

/**
 * Everything a budget row shows that depends on a date, worked out here on
 * the server: a client render in another timezone would print another day.
 * Running budgets come in pace order (blown, ahead, then by share spent);
 * the ended ones come apart.
 */
export function buildBudgetRows(
  progressList: BudgetProgress[],
  categoryById: ReadonlyMap<string, CategoryLook>,
  today: Date,
): { running: BudgetRowProps[]; ended: BudgetRowProps[] } {
  const progressById = new Map(
    progressList.map((progress) => [progress.budget.id, progress]),
  );

  function rowOf(
    progress: BudgetProgress,
    status: BudgetRowProps['status'],
  ): BudgetRowProps {
    const { budget, period, amount, spent } = progress;
    const category = categoryById.get(budget.categoryId);
    const running = status !== 'ended';
    const limitDay =
      running && spent < amount
        ? projectedLimitDay(amount, spent, period, today)?.getDate()
        : undefined;

    return {
      budgetId: budget.id,
      name: category?.name ?? 'Categoria removida',
      color: category?.color,
      kindLabel: !running
        ? 'Encerrado'
        : budget.kind === 'fixed'
          ? `Até ${dayAndMonth(period.end)}`
          : 'Todo mês',
      spent,
      amount,
      currency: budget.currency,
      status,
      limitDay: limitDay === undefined ? undefined : String(limitDay),
    };
  }

  return {
    running: calculateBudgetPace(progressList, today).flatMap((pace) => {
      const progress = progressById.get(pace.budgetId);
      return progress ? [rowOf(progress, pace.status)] : [];
    }),
    ended: progressList
      .filter(({ running }) => !running)
      .map((progress) => rowOf(progress, 'ended')),
  };
}

/** "Parcelas de novembro: R$ 320,00", or nothing when no installment falls this month. */
export function installmentsLabel(
  installmentsThisMonth: number,
  today: Date,
): string | undefined {
  if (installmentsThisMonth <= 0) return undefined;
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(
    today,
  );
  return `Parcelas de ${month}: ${formatCurrency(installmentsThisMonth)}`;
}
