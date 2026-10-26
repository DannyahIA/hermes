'use client';

import { Ellipsis } from 'lucide-react';
import { useState, useTransition } from 'react';

import { CategoryDot } from '@/app/dashboard/category-picker';
import {
  deleteRecurringTransactionAction,
  toggleRecurringTransactionActiveAction,
} from '@/app/transactions/recurring-actions';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Menu, MenuItem } from '@/components/ui/menu';
import { toast } from '@/shared/hooks/use-toast';
import { cn } from '@/shared/lib/cn';

import {
  ACCOUNT_ICONS,
  type AccountOption,
  signedAmount,
} from './transaction-row';

export interface RecurringRuleView {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  /** "Todo dia 10", "Primeiro dia útil". */
  rule: string;
  accountName: string;
  accountType: AccountOption['type'];
  category?: { name: string; color?: string };
  /** "10 de nov."; null when paused or over. */
  next: string | null;
  active: boolean;
  /** Its end date has passed: nothing more to write. */
  ended: boolean;
}

/**
 * A rule on the "Recorrências" tab: one line on a wide list, two on a
 * narrow one, with the same columns from row to row.
 */
export function RecurringTransactionRow({ rule }: { rule: RecurringRuleView }) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function toggle() {
    startTransition(async () => {
      const result = await toggleRecurringTransactionActiveAction(
        rule.id,
        !rule.active,
      );
      toast(
        result.success
          ? {
              title: rule.active
                ? 'Recorrência pausada.'
                : 'Recorrência reativada.',
              variant: 'success',
            }
          : {
              title: result.error ?? 'Não foi possível concluir.',
              variant: 'error',
            },
      );
    });
  }

  async function remove() {
    const result = await deleteRecurringTransactionAction(rule.id);
    toast(
      result.success
        ? { title: 'Recorrência excluída.', variant: 'success' }
        : {
            title: result.error ?? 'Não foi possível excluir.',
            variant: 'error',
          },
    );
  }

  const AccountIcon = ACCOUNT_ICONS[rule.accountType];
  const status = rule.ended
    ? 'Encerrada'
    : !rule.active
      ? 'Pausada'
      : rule.next
        ? `próxima ${rule.next}`
        : null;

  return (
    <li
      className={cn(
        'border-border border-b last:border-b-0',
        isPending && 'opacity-60',
      )}
    >
      {/* Three lines on a narrow list (what, when, where it's filed); one
          on a wide one, with the account under the name. */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_2rem] items-center gap-x-3 gap-y-0.5 px-4 py-2.5 @3xl:grid-cols-[minmax(0,1fr)_8rem_9.5rem_minmax(0,0.7fr)_8.75rem_2rem] @3xl:gap-x-4">
        <div className="col-start-1 row-start-1 min-w-0">
          <p className="truncate font-medium" title={rule.description}>
            {rule.description}
          </p>
          <p className="text-muted-foreground hidden min-w-0 items-center gap-1.5 text-xs @3xl:flex">
            <AccountIcon aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{rule.accountName}</span>
          </p>
        </div>

        <p
          className={cn(
            'dimension-figure col-start-2 row-start-1 text-right whitespace-nowrap @3xl:col-start-5',
            rule.active && !rule.ended
              ? rule.type === 'income'
                ? 'text-success'
                : 'text-destructive'
              : 'text-muted-foreground',
          )}
        >
          {signedAmount(rule.amount, rule.type === 'income' ? 'in' : 'out')}
        </p>

        <p className="text-muted-foreground col-span-2 col-start-1 row-start-2 flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs @3xl:contents @3xl:text-sm">
          <span className="whitespace-nowrap @3xl:col-start-2 @3xl:row-start-1">
            {rule.rule}
            {status && (
              <span aria-hidden className="@3xl:hidden">
                ,
              </span>
            )}
          </span>
          {status && (
            <span
              className={cn(
                'whitespace-nowrap @3xl:col-start-3 @3xl:row-start-1 @3xl:justify-self-start',
                (!rule.active || rule.ended) &&
                  'border-border rounded-sm border px-1.5 text-xs',
              )}
            >
              {status}
            </span>
          )}
        </p>

        <div className="text-muted-foreground col-span-2 col-start-1 row-start-3 flex min-w-0 items-center gap-x-3 text-xs @3xl:col-span-1 @3xl:col-start-4 @3xl:row-start-1 @3xl:text-sm">
          <span className="flex max-w-[55%] min-w-0 shrink-0 items-center gap-1.5 @3xl:max-w-none">
            {rule.category ? (
              <>
                <CategoryDot color={rule.category.color} />
                <span className="truncate">{rule.category.name}</span>
              </>
            ) : (
              <span className="truncate">Sem categoria</span>
            )}
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-1.5 @3xl:hidden">
            <AccountIcon aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{rule.accountName}</span>
          </span>
        </div>

        <div className="col-start-3 row-span-3 row-start-1 justify-self-end @3xl:col-start-6 @3xl:row-span-1">
          <Menu
            label={`Ações de ${rule.description}`}
            trigger={<Ellipsis aria-hidden className="size-4" />}
            triggerClassName="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring aria-expanded:bg-accent inline-flex size-8 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            {!rule.ended && (
              <MenuItem onSelect={toggle}>
                {rule.active ? 'Pausar' : 'Reativar'}
              </MenuItem>
            )}
            <MenuItem destructive onSelect={() => setConfirming(true)}>
              Excluir
            </MenuItem>
          </Menu>
        </div>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Excluir recorrência"
        description={`Isso não apaga as transações já geradas por "${rule.description}", só interrompe as próximas.`}
        onConfirm={remove}
      />
    </li>
  );
}
