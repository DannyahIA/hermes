'use client';

import { useTransition } from 'react';

import { AccountEditDialog } from '@/app/accounts/account-edit-dialog';
import {
  archiveAccountAction,
  deleteAccountAction,
} from '@/app/accounts/actions';
import { PayBillDialog } from '@/app/accounts/pay-bill-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
    <Card className="p-5">
      <CardHeader className="p-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{name}</CardTitle>
          {archived && <Badge variant="outline">Arquivada</Badge>}
        </div>
      </CardHeader>
      <CardContent className="mt-3 space-y-4 p-0">
        <div>
          <p className="text-muted-foreground text-xs">
            {ACCOUNT_TYPE_LABELS[type]}
          </p>
          <p className="ledger-figure mt-1 text-2xl font-semibold">
            {formatCurrency(balance, currency)}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {isCredit ? 'Fatura atual' : 'Saldo'}
            {isCredit && nextDueLabel ? ` · vence em ${nextDueLabel}` : null}
          </p>
          {projectedBalance !== undefined && (
            <p className="text-muted-foreground text-xs">
              Projetado: {formatCurrency(projectedBalance, currency)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {isCredit && payingAccounts.length > 0 && !archived && (
            <PayBillDialog
              creditAccountId={id}
              balance={balance}
              payingAccounts={payingAccounts}
            />
          )}
          <AccountEditDialog
            id={id}
            name={name}
            type={type}
            currency={currency}
            closingDay={closingDay}
            dueDay={dueDay}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={handleArchiveToggle}
          >
            {archived ? 'Reativar' : 'Arquivar'}
          </Button>
          <ConfirmDialog
            trigger={
              <Button variant="destructive" size="sm">
                Excluir
              </Button>
            }
            title="Excluir conta"
            description={`Tem certeza que deseja excluir "${name}"? Esta ação não pode ser desfeita.`}
            onConfirm={handleDelete}
          />
        </div>
      </CardContent>
    </Card>
  );
}
