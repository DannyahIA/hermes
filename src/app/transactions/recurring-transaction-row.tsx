'use client';

import { useTransition } from 'react';

import {
  deleteRecurringTransactionAction,
  toggleRecurringTransactionActiveAction,
} from '@/app/transactions/recurring-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/shared/hooks/use-toast';
import { formatCurrency } from '@/shared/lib/format-currency';

const RULE_LABELS: Record<string, string> = {
  fixed_day: 'Todo dia',
  first_business_day: 'Primeiro dia útil',
  last_business_day: 'Último dia útil',
};

interface RecurringTransactionRowProps {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  dayRuleKind: 'fixed_day' | 'first_business_day' | 'last_business_day';
  dayRuleDay?: number;
  active: boolean;
}

export function RecurringTransactionRow({
  id,
  description,
  amount,
  type,
  dayRuleKind,
  dayRuleDay,
  active,
}: RecurringTransactionRowProps) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleRecurringTransactionActiveAction(id, !active);
      toast(
        result.success
          ? {
              title: active ? 'Recorrência pausada.' : 'Recorrência reativada.',
              variant: 'success',
            }
          : {
              title: result.error ?? 'Não foi possível concluir.',
              variant: 'error',
            },
      );
    });
  }

  async function handleDelete() {
    const result = await deleteRecurringTransactionAction(id);
    toast(
      result.success
        ? { title: 'Recorrência excluída.', variant: 'success' }
        : {
            title: result.error ?? 'Não foi possível excluir.',
            variant: 'error',
          },
    );
  }

  const ruleLabel =
    dayRuleKind === 'fixed_day'
      ? `Todo dia ${dayRuleDay}`
      : RULE_LABELS[dayRuleKind];

  return (
    <div className="dimension-row flex-col items-stretch gap-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            {description}
            {!active && (
              <Badge variant="outline" className="ml-2 align-middle">
                Pausada
              </Badge>
            )}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">{ruleLabel}</p>
        </div>
        <p
          className={`dimension-figure shrink-0 text-sm font-semibold ${
            type === 'income' ? 'text-success' : 'text-destructive'
          }`}
        >
          {formatCurrency(amount)}
        </p>
      </div>
      <div className="flex justify-end gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={handleToggle}
        >
          {active ? 'Pausar' : 'Reativar'}
        </Button>
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="sm">
              Excluir
            </Button>
          }
          title="Excluir recorrência"
          description={`Isso não apaga as transações já geradas por "${description}", só interrompe as próximas.`}
          onConfirm={handleDelete}
        />
      </div>
    </div>
  );
}
