'use client';

import { Ellipsis } from 'lucide-react';
import { useState, useTransition } from 'react';

import { AccountEditDialog } from '@/app/accounts/account-edit-dialog';
import {
  archiveAccountAction,
  deleteAccountAction,
} from '@/app/accounts/actions';
import { PayBillDialog } from '@/app/accounts/pay-bill-dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Menu, MenuItem } from '@/components/ui/menu';
import { ACCOUNT_TYPE_LABELS, type AccountType } from '@/config/constants';
import { toast } from '@/shared/hooks/use-toast';
import { formatCurrency } from '@/shared/lib/format-currency';

interface AccountCardProps {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  /** Balance including scheduled future commitments (installments, recurring bills), when it differs from `balance`. */
  projectedBalance?: number;
  currency: string;
  archived: boolean;
  closingDay?: number;
  dueDay?: number;
  /** Formatted "vence em DD/MM" label, precomputed server-side from `nextDueDate`. */
  nextDueLabel?: string;
  /** The user's non-credit accounts, used to populate the "pay bill" dialog. */
  payingAccounts: Array<{ id: string; name: string }>;
}

export function AccountCard({
  id,
  name,
  type,
  balance,
  projectedBalance,
  currency,
  archived,
  closingDay,
  dueDay,
  nextDueLabel,
  payingAccounts,
}: AccountCardProps) {
  const [isPending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);
  const isCredit = type === 'credit';

  function handleArchiveToggle() {
    startTransition(async () => {
      const result = await archiveAccountAction(id, !archived);
      toast(
        result.success
          ? {
              title: archived ? 'Conta reativada.' : 'Conta arquivada.',
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
    const result = await deleteAccountAction(id);
    toast(
      result.success
        ? { title: 'Conta excluída.', variant: 'success' }
        : {
            title: result.error ?? 'Não foi possível excluir.',
            variant: 'error',
          },
    );
  }

  return (
    <Card className="flex flex-col p-0">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <h3
            className="font-display text-heading truncate font-semibold"
            title={name}
          >
            {name}
          </h3>
          <p className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
            {ACCOUNT_TYPE_LABELS[type]}
            {archived && <Badge variant="outline">Arquivada</Badge>}
          </p>
        </div>
        <Menu
          label={`Ações de ${name}`}
          trigger={<Ellipsis aria-hidden className="size-4" />}
          triggerClassName="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-ring aria-expanded:bg-accent -mt-1 -mr-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-2"
        >
          <MenuItem onSelect={handleArchiveToggle}>
            {archived ? 'Reativar' : 'Arquivar'}
          </MenuItem>
          <MenuItem destructive onSelect={() => setDeleting(true)}>
            Excluir
          </MenuItem>
        </Menu>
      </div>

      <div className="flex-1 px-4 pt-3 pb-4">
        <p className="text-muted-foreground text-xs">
          {isCredit ? 'Fatura atual' : 'Saldo'}
          {isCredit && nextDueLabel ? `, vence em ${nextDueLabel}` : null}
        </p>
        <p className="dimension-figure text-figure mt-0.5 font-semibold whitespace-nowrap">
          {formatCurrency(balance, currency)}
        </p>
        {projectedBalance !== undefined && (
          <p className="text-muted-foreground mt-0.5 text-xs">
            Projetado:{' '}
            <span className="dimension-figure">
              {formatCurrency(projectedBalance, currency)}
            </span>
          </p>
        )}
      </div>

      <div className="border-border bg-subtle flex flex-wrap items-center gap-2 rounded-b-[inherit] border-t px-4 py-2.5">
        <AccountEditDialog
          id={id}
          name={name}
          type={type}
          currency={currency}
          closingDay={closingDay}
          dueDay={dueDay}
        />
        {isCredit && payingAccounts.length > 0 && !archived && (
          <PayBillDialog
            creditAccountId={id}
            balance={balance}
            payingAccounts={payingAccounts}
          />
        )}
        {isPending && (
          <span className="text-muted-foreground text-xs" role="status">
            Salvando…
          </span>
        )}
      </div>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Excluir conta"
        description={`Tem certeza que deseja excluir "${name}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleDelete}
      />
    </Card>
  );
}
