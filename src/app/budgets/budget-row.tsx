'use client';

import { Ellipsis } from 'lucide-react';
import { useState } from 'react';

import { deleteBudgetAction } from '@/app/budgets/actions';
import { ChangeBudgetLimitDialog } from '@/app/budgets/change-budget-limit-dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Menu, MenuItem } from '@/components/ui/menu';
import type { BudgetPaceStatus } from '@/modules/dashboard/application/metrics/calculate-budget-pace';
import { toast } from '@/shared/hooks/use-toast';
import { cn } from '@/shared/lib/cn';
import { formatCurrency } from '@/shared/lib/format-currency';
import { formatPercent } from '@/shared/lib/format-percent';

export interface BudgetRowProps {
  budgetId: string;
  /** The category's name. */
  name: string;
  /** The category's colour, for its dot. */
  color?: string;
  /** "Todo mês", "Até 15/11" or "Encerrado", formatted on the server. */
  kindLabel: string;
  spent: number;
  amount: number;
  currency?: string;
  status: BudgetPaceStatus | 'ended';
  /** The day of the month spending reaches the limit, formatted on the server. */
  limitDay?: string;
}

const STAGES = [100, 95, 90, 75] as const;

const PACE_LABELS: Record<BudgetPaceStatus, string> = {
  'on-pace': 'No ritmo',
  ahead: 'Acima do ritmo',
  over: 'Passou do limite',
};

function stageReached(share: number): number | null {
  return STAGES.find((stage) => share >= stage / 100) ?? null;
}

/** Colour comes from the share spent, never from the pace. */
function tone(share: number) {
  if (share >= 1) return { text: 'text-destructive', bar: 'bg-destructive' };
  if (share >= 0.75) {
    return { text: 'text-warning-strong', bar: 'bg-warning-strong' };
  }
  return { text: 'text-foreground', bar: 'bg-foreground' };
}

/**
 * One budget as a thin row: whose, how much of the limit is gone, how far
 * along the period it is going and, in the menu, what can be done with it.
 */
export function BudgetRow({
  budgetId,
  name,
  color,
  kindLabel,
  spent,
  amount,
  currency = 'BRL',
  status,
  limitDay,
}: BudgetRowProps) {
  const [changing, setChanging] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const share = amount > 0 ? spent / amount : 0;
  const colours = tone(share);
  // Once the limit is reached the pace label says so; a stage would repeat it.
  const stage = share < 1 ? stageReached(share) : null;
  const pace = status === 'ended' ? null : PACE_LABELS[status];
  const filled = Math.min(Math.max(share, 0), 1) * 100;

  async function handleDelete() {
    const result = await deleteBudgetAction(budgetId);
    toast(
      result.success
        ? { title: 'Orçamento excluído.', variant: 'success' }
        : {
            title: result.error ?? 'Não foi possível excluir.',
            variant: 'error',
          },
    );
  }

  return (
    <li className="border-border border-b px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="order-1 flex min-w-0 flex-1 items-center gap-2.5">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color ?? 'var(--faint-foreground)' }}
            aria-hidden
          />
          <span className="truncate font-medium" title={name}>
            {name}
          </span>
        </span>
        <span className="order-3 flex w-full items-baseline justify-between gap-3 sm:order-2 sm:w-auto sm:justify-end">
          <span className="text-muted-foreground shrink-0 text-xs">
            {kindLabel}
          </span>
          <span className={cn('dimension-figure text-sm', colours.text)}>
            {`${formatCurrency(spent, currency)} de ${formatCurrency(amount, currency)}`}
          </span>
        </span>
        <span className="order-2 sm:order-3">
          <Menu
            label={`Ações de ${name}`}
            trigger={<Ellipsis aria-hidden className="size-4" />}
            triggerClassName="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-ring aria-expanded:bg-accent inline-flex size-8 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-2"
          >
            <MenuItem onSelect={() => setChanging(true)}>
              Alterar limite
            </MenuItem>
            <MenuItem destructive onSelect={() => setDeleting(true)}>
              Excluir
            </MenuItem>
          </Menu>
        </span>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <div
          role="progressbar"
          aria-label={`Quanto de ${name} já foi gasto`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(filled)}
          className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full"
        >
          <div
            className={cn('h-full rounded-full', colours.bar)}
            style={{ width: `${filled}%` }}
          />
        </div>
        <span
          className={cn(
            'dimension-figure w-10 text-right text-xs',
            colours.text,
          )}
        >
          {formatPercent(share * 100)}
        </span>
      </div>

      {(stage || pace || limitDay) && (
        <p className="text-muted-foreground mt-1.5 flex flex-wrap gap-x-3 text-xs">
          {stage && <span>{`Passou de ${stage}%`}</span>}
          {pace && <span>{pace}</span>}
          {share > 1 && (
            <span className="dimension-figure">{`${formatCurrency(spent - amount, currency)} acima`}</span>
          )}
          {limitDay && <span>{`Estoura dia ${limitDay}`}</span>}
        </p>
      )}

      <ChangeBudgetLimitDialog
        budgetId={budgetId}
        name={name}
        amount={amount}
        open={changing}
        onOpenChange={setChanging}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Excluir orçamento"
        description={`Tem certeza que deseja excluir o orçamento de "${name}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleDelete}
      />
    </li>
  );
}
