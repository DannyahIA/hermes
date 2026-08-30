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

/**
 * Column widths shared by the desktop header row (`TransactionList`) and
 * every `TransactionRow` — defined once so header cells and data cells
 * always line up, instead of each row computing its own widths from its
 * own content (which is what a bare per-row `<table>` would do).
 * Data | Descrição | Conta | Categoria | Tipo | Valor | ações
 *
 * The Descrição track has a 160px floor (not `minmax(0,1fr)`): the page
 * puts this table in a `min-w-0` grid column next to a fixed 360px sidebar
 * (see transactions/page.tsx), so on a narrow-enough viewport the
 * available width drops below the other six columns' combined fixed
 * width. A `0` floor let that column collapse to 0px and its text render
 * on top of the Conta column instead of scrolling — `TRANSACTION_ROW_MIN_WIDTH`
 * below is what makes the table scroll horizontally instead once it does.
 */
export const TRANSACTION_ROW_GRID_TEMPLATE =
  '110px minmax(160px,1fr) 140px 140px 90px 120px 160px';

/** Sum of every column's floor (110 + 160 + 140 + 140 + 90 + 120 + 160) —
 * applied as each row's `min-width` so the grid can never be squeezed
 * narrower than this, forcing the table's `overflow-x-auto` ancestor to
 * scroll instead of silently collapsing the Descrição column. */
export const TRANSACTION_ROW_MIN_WIDTH = 920;

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

/**
 * Desktop row — rendered as a CSS grid row (not a `<table>` row) so its
 * column widths come from the shared `TRANSACTION_ROW_GRID_TEMPLATE`
 * rather than being computed independently per row, which is what left
 * columns ragged/misaligned between rows before this fix.
 */
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
    <div
      role="row"
      className="border-border/70 grid items-center border-b last:border-0"
      style={{
        gridTemplateColumns: TRANSACTION_ROW_GRID_TEMPLATE,
        minWidth: TRANSACTION_ROW_MIN_WIDTH,
      }}
    >
      <div role="cell" className="px-4 py-3 text-sm">
        {formatDate(occurredAt)}
      </div>
      <div role="cell" className="min-w-0 px-4 py-3 text-sm font-medium">
        <span className="inline-block truncate">{description}</span>
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
      </div>
      <div role="cell" className="text-muted-foreground px-4 py-3 text-sm">
        {accountName}
      </div>
      <div role="cell" className="text-muted-foreground px-4 py-3 text-sm">
        {categoryName ?? '—'}
      </div>
      <div role="cell" className="px-4 py-3 text-sm">
        {TRANSACTION_TYPE_LABELS[type]}
      </div>
      <div
        role="cell"
        className={`dimension-figure px-4 py-3 text-right text-sm font-semibold ${
          type === 'income'
            ? 'text-success'
            : type === 'expense'
              ? 'text-destructive'
              : ''
        }`}
      >
        {formatCurrency(amount)}
      </div>
      <div role="cell" className="px-4 py-3 text-right whitespace-nowrap">
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
