import Link from 'next/link';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ROUTES } from '@/config/routes';
import type {
  BudgetPace,
  BudgetPaceStatus,
} from '@/modules/dashboard/application/metrics/calculate-budget-pace';
import { cn } from '@/shared/lib/cn';
import { formatCurrency } from '@/shared/lib/format-currency';

const VISIBLE_BUDGETS = 5;

const STATUS: Record<
  BudgetPaceStatus,
  { label: string; text: string; bar: string }
> = {
  'on-pace': {
    label: 'No ritmo',
    text: 'text-muted-foreground',
    bar: 'bg-primary',
  },
  ahead: {
    label: 'Acima do ritmo',
    text: 'text-warning-strong',
    bar: 'bg-warning',
  },
  over: { label: 'Estourado', text: 'text-destructive', bar: 'bg-destructive' },
};

interface BudgetPaceListProps {
  paces: BudgetPace[];
  categoryNames: Map<string, string>;
}

/**
 * Each budget running today, measured against how much of its period has
 * gone by (spec 2026-10-17-inicio-hub-design.md §4.4). The mark on each
 * bar is today; the status is always written out, never left to color.
 */
export function BudgetPaceList({ paces, categoryNames }: BudgetPaceListProps) {
  const visible = paces.slice(0, VISIBLE_BUDGETS);
  const sharedElapsed = paces.every(
    (pace) => pace.elapsedShare === paces[0]?.elapsedShare,
  )
    ? paces[0]?.elapsedShare
    : undefined;

  return (
    <Card className="p-6">
      <CardHeader className="p-0">
        <CardTitle className="text-xl">Orçamentos</CardTitle>
        <CardDescription>
          {paces.length === 0
            ? 'Quanto você pode gastar em cada categoria.'
            : sharedElapsed !== undefined
              ? `A marca em cada barra é hoje: ${Math.round(sharedElapsed * 100)}% do período já passou.`
              : 'A marca em cada barra mostra quanto do período já passou.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="mt-2 p-0">
        {paces.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">
            Nenhum orçamento em andamento. Crie um para acompanhar o ritmo de
            gastos.{' '}
            <Link href={ROUTES.budgets} className="text-foreground underline">
              Criar orçamento
            </Link>
          </p>
        ) : (
          <>
            <ul>
              {visible.map((pace) => (
                <BudgetPaceRow
                  key={pace.budgetId}
                  pace={pace}
                  name={
                    categoryNames.get(pace.categoryId) ?? 'Categoria removida'
                  }
                />
              ))}
            </ul>
            {paces.length > visible.length && (
              <Link
                href={ROUTES.budgets}
                className="text-muted-foreground hover:text-foreground mt-2 inline-block py-1 text-sm underline-offset-4 hover:underline"
              >
                Ver todos ({paces.length})
              </Link>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function BudgetPaceRow({ pace, name }: { pace: BudgetPace; name: string }) {
  const status = STATUS[pace.status];
  const left = pace.amount - pace.spent;

  return (
    <li className="dimension-row block">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate font-medium" title={name}>
          {name}
        </p>
        <p className={cn('shrink-0 text-sm', status.text)}>{status.label}</p>
      </div>
      <p className="text-muted-foreground mt-0.5 text-xs">
        <span className="dimension-figure">
          {formatCurrency(pace.spent, pace.currency)}
        </span>{' '}
        de{' '}
        <span className="dimension-figure">
          {formatCurrency(pace.amount, pace.currency)}
        </span>
        {', '}
        {left >= 0 ? 'restam ' : ''}
        <span className="dimension-figure">
          {formatCurrency(Math.abs(left), pace.currency)}
        </span>
        {left < 0 ? ' acima' : ''}
      </p>
      <div aria-hidden className="bg-muted relative mt-2.5 h-1.5">
        <div
          className={cn('h-full', status.bar)}
          style={{ width: `${Math.min(pace.spentShare, 1) * 100}%` }}
        />
        <span
          className="bg-foreground absolute -top-1 h-3.5 w-px"
          style={{ left: `${pace.elapsedShare * 100}%` }}
        />
      </div>
    </li>
  );
}
