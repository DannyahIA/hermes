'use client';

import { ChevronRight, Ellipsis } from 'lucide-react';
import Link from 'next/link';
import { useId, useState, useTransition } from 'react';

import { AccountEditDialog } from '@/app/accounts/account-edit-dialog';
import {
  archiveAccountAction,
  deleteAccountAction,
} from '@/app/accounts/actions';
import { PayBillDialog } from '@/app/accounts/pay-bill-dialog';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Menu, MenuItem } from '@/components/ui/menu';
import { ROUTES } from '@/config/routes';
import type { AccountLine } from '@/modules/accounts/application/get-money-overview.use-case';
import { toast } from '@/shared/hooks/use-toast';
import { cn } from '@/shared/lib/cn';
import { formatCurrency } from '@/shared/lib/format-currency';
import { formatDate } from '@/shared/lib/format-date';
import { transactionSearch } from '@/shared/lib/transaction-query';

/** One of an account's latest transactions, as plain data a client component can take. */
export interface RecentLine {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  /** ISO timestamp. */
  occurredAt: string;
}

/** A card's bills today: what is open, what closed and is still owed, and when the open one is due. */
export interface CardBills {
  open: number;
  closed: number;
  dueLabel: string;
}

const dayMonth = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
});

function cardNote(line: AccountLine): string | null {
  if (line.type !== 'credit') return null;
  const parts: string[] = [];
  if (line.closingDay) parts.push(`fecha dia ${line.closingDay}`);
  if (line.dueDay) parts.push(`vence dia ${line.dueDay}`);
  if (line.nextDue)
    parts.push(`próximo vencimento ${dayMonth.format(line.nextDue)}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

function signedAmount(line: RecentLine): string {
  const text = formatCurrency(line.amount);
  if (line.type === 'income') return `+ ${text}`;
  if (line.type === 'expense') return `− ${text}`;
  return text;
}

interface AccountRowProps {
  account: AccountLine;
  /** The latest transactions of this account, newest first. */
  recent: RecentLine[];
  /** Only for a card with a closing and a due day. */
  statement?: CardBills;
  /** The user's non-credit accounts, to pay a bill from. */
  payingAccounts: Array<{ id: string; name: string }>;
}

/**
 * One account: a thin row of its name and balance, and below it, when
 * opened, its latest transactions and what can be done with it. The row
 * is the button that opens it, like a category.
 */
export function AccountRow({
  account,
  recent,
  statement,
  payingAccounts,
}: AccountRowProps) {
  const detailId = useId();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isCredit = account.type === 'credit';
  const note = cardNote(account);

  function handleArchiveToggle() {
    startTransition(async () => {
      const result = await archiveAccountAction(account.id, !account.archived);
      toast(
        result.success
          ? {
              title: account.archived ? 'Conta reativada.' : 'Conta arquivada.',
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
    const result = await deleteAccountAction(account.id);
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
    <li className="border-border border-b last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? detailId : undefined}
        onClick={() => setOpen((value) => !value)}
        className="hover:bg-subtle focus-visible:ring-ring flex w-full items-center justify-between gap-4 rounded-sm py-2.5 text-left focus-visible:ring-2 focus-visible:outline-none"
      >
        <span className="flex min-w-0 items-center gap-2">
          <ChevronRight
            aria-hidden
            className={cn(
              'text-muted-foreground size-4 shrink-0 transition-transform',
              open && 'rotate-90',
            )}
          />
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate font-medium" title={account.name}>
                {account.name}
              </span>
              {account.archived && <Badge variant="outline">Arquivada</Badge>}
              {!account.archived && account.hidden && (
                <Badge variant="outline">Oculta</Badge>
              )}
            </span>
            {note && (
              <span className="text-muted-foreground block text-xs">
                {note}
              </span>
            )}
          </span>
        </span>
        <span className="dimension-figure font-semibold whitespace-nowrap">
          {formatCurrency(account.balance, account.currency)}
        </span>
      </button>

      {open && (
        <div id={detailId} className="pt-1 pb-4 pl-6">
          {isCredit && statement && (
            <dl className="mb-3 space-y-1 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Fatura aberta</dt>
                <dd className="dimension-figure">
                  {formatCurrency(statement.open, account.currency)}
                </dd>
              </div>
              {statement.closed >= 0.005 && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Fatura fechada</dt>
                  <dd className="dimension-figure">
                    {formatCurrency(statement.closed, account.currency)}
                  </dd>
                </div>
              )}
              <p className="text-muted-foreground text-xs">
                vence {statement.dueLabel}
              </p>
            </dl>
          )}

          <h3 className="text-sm font-medium">Últimas transações</h3>
          {recent.length === 0 ? (
            <p className="text-muted-foreground mt-2 text-sm">
              Nenhuma transação ainda.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm">
              {recent.map((line) => (
                <li
                  key={line.id}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="min-w-0 truncate">
                    {line.description}
                    <span className="text-muted-foreground ml-2 text-xs">
                      {formatDate(new Date(line.occurredAt))}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'dimension-figure shrink-0',
                      line.type === 'income' && 'text-success',
                      line.type === 'expense' && 'text-destructive',
                    )}
                  >
                    {signedAmount(line)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              href={`${ROUTES.transactions}${transactionSearch({ accountId: account.id })}`}
              className="text-primary mr-auto text-sm font-medium underline-offset-4 hover:underline"
            >
              Ver transações
            </Link>
            {isPending && (
              <span className="text-muted-foreground text-xs" role="status">
                Salvando…
              </span>
            )}
            <AccountEditDialog
              id={account.id}
              name={account.name}
              type={account.type}
              currency={account.currency}
              closingDay={account.closingDay}
              dueDay={account.dueDay}
            />
            {isCredit && payingAccounts.length > 0 && !account.archived && (
              <PayBillDialog
                creditAccountId={account.id}
                balance={account.balance}
                payingAccounts={payingAccounts}
              />
            )}
            <Menu
              label={`Ações de ${account.name}`}
              trigger={<Ellipsis aria-hidden className="size-4" />}
              triggerClassName="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-ring aria-expanded:bg-accent inline-flex size-8 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-2"
            >
              <MenuItem onSelect={handleArchiveToggle}>
                {account.archived ? 'Reativar' : 'Arquivar'}
              </MenuItem>
              <MenuItem destructive onSelect={() => setDeleting(true)}>
                Excluir
              </MenuItem>
            </Menu>
          </div>

          <ConfirmDialog
            open={deleting}
            onOpenChange={setDeleting}
            title="Excluir conta"
            description={`Tem certeza que deseja excluir "${account.name}"? Esta ação não pode ser desfeita.`}
            onConfirm={handleDelete}
          />
        </div>
      )}
    </li>
  );
}
