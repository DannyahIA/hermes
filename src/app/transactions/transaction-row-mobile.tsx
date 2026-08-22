'use client';

import { deleteTransactionAction } from '@/app/transactions/actions';
import { TransactionEditDialog } from '@/app/transactions/transaction-edit-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/shared/hooks/use-toast';
import { formatCurrency } from '@/shared/lib/format-currency';
import { formatDate } from '@/shared/lib/format-date';

interface TransactionRowMobileProps {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  occurredAt: Date;
  accountName: string;
  categoryId?: string;
  categoryName?: string;
  categories: Array<{ id: string; name: string }>;
  installmentLabel?: string;
  isRecurring?: boolean;
}

/**
 * The narrow-viewport counterpart to `TransactionRow` — a stacked
 * row instead of a table row, since a 7-column table has nowhere to go on
 * a 375px screen (ui-ux.md: Mobile First, "nenhuma funcionalidade deve
 * existir apenas no desktop").
 */
export function TransactionRowMobile({
  id,
  description,
  amount,
  type,
  occurredAt,
  accountName,
  categoryId,
  categoryName,
  categories,
  installmentLabel,
  isRecurring,
}: TransactionRowMobileProps) {
  async function handleDelete() {
    const result = await deleteTransactionAction(id);
    toast(
      result.success
        ? { title: 'Transação excluída.', variant: 'success' }
        : {
            title: result.error ?? 'Não foi possível excluir.',
            variant: 'error',
          },
    );
  }

  return (
    <div className="dimension-row flex-col items-stretch gap-2 sm:hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            {description}
            {installmentLabel && (
              <Badge variant="outline" className="ml-2 align-middle">
                {installmentLabel}
              </Badge>
            )}
            {isRecurring && (
              <Badge variant="outline" className="ml-2 align-middle">
                Recorrente
              </Badge>
            )}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {formatDate(occurredAt)} · {accountName}
            {categoryName ? ` · ${categoryName}` : ''}
          </p>
        </div>
        <p
          className={`dimension-figure shrink-0 text-sm font-semibold ${
            type === 'income'
              ? 'text-success'
              : type === 'expense'
                ? 'text-destructive'
                : ''
          }`}
        >
          {formatCurrency(amount)}
        </p>
      </div>
      <div className="flex justify-end gap-1">
        {type !== 'transfer' && (
          <TransactionEditDialog
            id={id}
            description={description}
            amount={amount}
            occurredAt={occurredAt}
            categoryId={categoryId}
            categories={categories}
            isInstallment={Boolean(installmentLabel)}
          />
        )}
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="sm">
              Excluir
            </Button>
          }
          title="Excluir transação"
          description={`Tem certeza que deseja excluir "${description}"? O saldo da conta será ajustado.`}
          onConfirm={handleDelete}
        />
      </div>
    </div>
  );
}
