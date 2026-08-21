'use client';

import { deleteTransactionAction } from '@/app/transactions/actions';
import { TransactionEditDialog } from '@/app/transactions/transaction-edit-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  TRANSACTION_TYPE_LABELS,
  type TransactionType,
} from '@/config/constants';
import { toast } from '@/shared/hooks/use-toast';
import { formatCurrency } from '@/shared/lib/format-currency';
import { formatDate } from '@/shared/lib/format-date';

interface TransactionRowProps {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  occurredAt: Date;
  accountName: string;
  categoryId?: string;
  categoryName?: string;
  categories: Array<{ id: string; name: string }>;
  installmentLabel?: string;
  isRecurring?: boolean;
}

export function TransactionRow({
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
}: TransactionRowProps) {
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
    <tr className="border-border/70 border-b last:border-0">
      <td className="px-4 py-3 text-sm">{formatDate(occurredAt)}</td>
      <td className="px-4 py-3 text-sm font-medium">
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
      </td>
      <td className="text-muted-foreground px-4 py-3 text-sm">{accountName}</td>
      <td className="text-muted-foreground px-4 py-3 text-sm">
        {categoryName ?? '—'}
      </td>
      <td className="px-4 py-3 text-sm">{TRANSACTION_TYPE_LABELS[type]}</td>
      <td
        className={`ledger-figure px-4 py-3 text-right text-sm font-semibold ${
          type === 'income'
            ? 'text-success'
            : type === 'expense'
              ? 'text-destructive'
              : ''
        }`}
      >
        {formatCurrency(amount)}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
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
      </td>
    </tr>
  );
}
