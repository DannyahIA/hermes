'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useId, useState, useTransition } from 'react';

import {
  categorizeTransactionAction,
  fileUnderNewCategoryAction,
} from '@/app/dashboard/actions';
import {
  CategoryDot,
  type CategoryOption,
} from '@/app/dashboard/category-picker';
import { deleteTransactionAction } from '@/app/transactions/actions';
import { TransactionEditDialog } from '@/app/transactions/transaction-edit-dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ROUTES } from '@/config/routes';
import type { TransactionGrouping } from '@/core/contracts/transaction-repository';
import { toast } from '@/shared/hooks/use-toast';
import { cn } from '@/shared/lib/cn';
import { formatDayHeading } from '@/shared/lib/format-date';
import { splitOrigin } from '@/shared/lib/transaction-origin';
import type { TransactionQuery } from '@/shared/lib/transaction-query';

import {
  BETWEEN_ACCOUNTS,
  groupListedTransactions,
  type TransactionGroup,
} from './group-listed-transactions';
import {
  type ListedPage,
  type ListedScheduled,
  type ListedTransaction,
  takesCategory,
} from './listed-transaction';
import {
  type AccountOption,
  signedAmount,
  TransactionRow,
} from './transaction-row';
import { useTransactionPages } from './use-transaction-pages';

export type ListCategory = CategoryOption & { archived: boolean };

interface TransactionListProps {
  initial: ListedPage;
  scheduled: ListedScheduled;
  query: TransactionQuery;
  grouping: TransactionGrouping;
  /** "2026-10-19", as the server reads it. */
  today: string;
  accounts: AccountOption[];
  /** Every category, archived ones too, to name what's already filed. */
  categories: ListCategory[];
  /** Whether any filter or search narrows the list. */
  filtered: boolean;
  /** A new search or filter is on its way. */
  pending: boolean;
}

const shortDate = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
});

function dateOf(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
}

const shortDateYear = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** "amanhã", "8 de nov.", or "8 de mar. de 2027" in another year. */
function whenLabel(day: string, today: string): string {
  if (formatDayHeading(day, today) === 'Amanhã') return 'amanhã';
  const date = dateOf(day);
  return (
    date.getFullYear() === Number(today.slice(0, 4)) ? shortDate : shortDateYear
  ).format(date);
}

function signedNet(net: number): string {
  return signedAmount(Math.abs(net), net > 0 ? 'in' : 'out');
}

/**
 * The statement (spec 2026-10-17-inicio-hub-design.md §5): what already
 * happened, grouped by day, month or category, each group with its total;
 * what is scheduled after today folded above it. "Sem categoria" opens the
 * same one-tap picker as "Para revisar" on the Início.
 */
export function TransactionList({
  initial,
  scheduled,
  query,
  grouping,
  today,
  accounts,
  categories,
  filtered,
  pending,
}: TransactionListProps) {
  const {
    transactions,
    totals,
    suggestions: pageSuggestions,
    newCategories: pageNewCategories,
    status,
    loadMore,
    sentinelRef,
  } = useTransactionPages(initial, query, grouping);
  const [filed, setFiled] = useState<Record<string, string>>({});
  /** Categories made here from the list, until the page reloads. */
  const [made, setMade] = useState<ListCategory[]>([]);
  /** Rows whose new category is being saved: they take no second request. */
  const [creating, setCreating] = useState<ReadonlySet<string>>(new Set());
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [picking, setPicking] = useState<string | null>(null);
  const [editing, setEditing] = useState<ListedTransaction | null>(null);
  const [deleting, setDeleting] = useState<ListedTransaction | null>(null);
  const [showScheduled, setShowScheduled] = useState(
    initial.transactions.length === 0,
  );
  const [, startTransition] = useTransition();
  const scheduledId = useId();

  const accountsById = new Map(
    accounts.map((account) => [account.id, account]),
  );
  const allCategories = [
    ...categories,
    ...made.filter(
      (category) => !categories.some((known) => known.id === category.id),
    ),
  ];
  const categoriesById = new Map(
    allCategories.map((category) => [category.id, category]),
  );
  const selectable = allCategories.filter((category) => !category.archived);
  const suggestions = { ...scheduled.suggestions, ...pageSuggestions };
  const newCategories = { ...scheduled.newCategories, ...pageNewCategories };

  const present = (rows: ListedTransaction[]) =>
    rows
      .filter((row) => !removed.has(row.id))
      .map((row) =>
        filed[row.id] ? { ...row, categoryId: filed[row.id] } : row,
      );
  const rows = present(transactions);
  const upcoming = present(scheduled.transactions);
  const groups = groupListedTransactions(
    rows,
    grouping,
    totals,
    today,
    categoriesById,
  );

  function categorize(row: ListedTransaction, category: CategoryOption) {
    setPicking(null);
    setFiled((current) => ({ ...current, [row.id]: category.id }));
    startTransition(async () => {
      const result = await categorizeTransactionAction(row.id, category.id);
      if (!result.success) {
        setFiled((current) => {
          const next = { ...current };
          delete next[row.id];
          return next;
        });
        toast({
          title: result.error ?? 'Não foi possível salvar a categoria.',
          variant: 'error',
        });
      }
    });
  }

  function create(row: ListedTransaction, name: string, color?: string) {
    setPicking(null);
    setCreating((current) => new Set(current).add(row.id));
    startTransition(async () => {
      const result = await fileUnderNewCategoryAction({
        transactionIds: [row.id],
        name,
        color,
      });
      setCreating((current) => {
        const next = new Set(current);
        next.delete(row.id);
        return next;
      });
      if (!result.success) {
        toast({ title: result.error, variant: 'error' });
        return;
      }
      const category: ListCategory = { ...result.category, archived: false };
      setMade((current) => [
        ...current.filter((known) => known.id !== category.id),
        category,
      ]);
      setFiled((current) => ({ ...current, [row.id]: category.id }));
    });
  }

  async function remove(row: ListedTransaction) {
    const result = await deleteTransactionAction(row.id);
    if (!result.success) {
      toast({
        title: result.error ?? 'Não foi possível excluir.',
        variant: 'error',
      });
      return;
    }
    setRemoved((current) => new Set(current).add(row.id));
    toast({ title: 'Transação excluída.', variant: 'success' });
  }

  function renderRow(row: ListedTransaction, byDay: boolean) {
    const lead = !byDay
      ? { text: shortDate.format(dateOf(row.day)), isTime: false }
      : row.time
        ? { text: row.time, isTime: true }
        : null;
    return (
      <TransactionRow
        key={row.id}
        transaction={row}
        category={
          row.categoryId ? categoriesById.get(row.categoryId) : undefined
        }
        account={accountsById.get(row.accountId)}
        settledCard={
          row.settlesAccountId
            ? accountsById.get(row.settlesAccountId)
            : undefined
        }
        lead={lead}
        suggestions={(suggestions[row.id] ?? [])
          .map((id) => categoriesById.get(id))
          .filter((category): category is ListCategory => !!category)}
        categories={selectable}
        newCategory={newCategories[row.id]}
        picking={picking === row.id}
        creating={creating.has(row.id)}
        onTogglePicking={() =>
          setPicking((current) => (current === row.id ? null : row.id))
        }
        onPick={(category) => categorize(row, category)}
        onCreate={(name, color) => create(row, name, color)}
        onEdit={row.type === 'transfer' ? undefined : () => setEditing(row)}
        onDelete={() => setDeleting(row)}
      />
    );
  }

  function renderGroup(group: TransactionGroup, byDay: boolean) {
    return (
      <section key={group.key} aria-label={group.label}>
        <h3 className="bg-subtle border-border text-muted-foreground flex items-baseline justify-between gap-3 border-y px-4 py-2 text-xs font-medium">
          <span className="flex min-w-0 items-center gap-2">
            {grouping === 'category' && group.key !== BETWEEN_ACCOUNTS && (
              <CategoryDot color={group.color} />
            )}
            <span className="truncate">{group.label}</span>
          </span>
          {group.total !== undefined && Math.abs(group.total) >= 0.005 && (
            <span className="dimension-figure shrink-0 whitespace-nowrap">
              <span className="sr-only">Total: </span>
              {signedNet(group.total)}
            </span>
          )}
        </h3>
        <ul>{group.rows.map((row) => renderRow(row, byDay))}</ul>
      </section>
    );
  }

  const nothing = rows.length === 0 && upcoming.length === 0;
  const lastUpcoming = upcoming.at(-1);

  return (
    <div
      aria-busy={pending}
      className={cn(
        'sheet-surface @container overflow-clip transition-opacity duration-[var(--duration-base)]',
        grouping === 'day' ? '[--lead:3rem]' : '[--lead:4.5rem]',
        pending && 'opacity-60',
      )}
    >
      <h2 className="sr-only">Lista de transações</h2>
      {upcoming.length > 0 && lastUpcoming && (
        <section aria-label="Agendadas" className="border-border border-b">
          <button
            type="button"
            aria-expanded={showScheduled}
            aria-controls={scheduledId}
            onClick={() => setShowScheduled((open) => !open)}
            className="hover:bg-subtle focus-visible:ring-ring flex w-full items-center gap-2 px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
          >
            <ChevronRight
              aria-hidden
              className={cn(
                'text-muted-foreground size-4 shrink-0 transition-transform',
                showScheduled && 'rotate-90',
              )}
            />
            <span className="flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-2">
              <span className="font-medium">Agendadas</span>
              <span className="text-muted-foreground truncate text-sm">
                {upcoming.length === 1
                  ? `1 lançamento, ${whenLabel(lastUpcoming.day, today) === 'amanhã' ? 'amanhã' : `em ${whenLabel(lastUpcoming.day, today)}`}`
                  : `${upcoming.length} lançamentos, até ${whenLabel(lastUpcoming.day, today)}`}
              </span>
            </span>
            {Math.abs(scheduled.net) >= 0.005 && (
              <span className="dimension-figure ml-auto shrink-0 pl-2 text-sm whitespace-nowrap">
                {signedNet(scheduled.net)}
              </span>
            )}
          </button>
          {showScheduled && (
            <div id={scheduledId} className="pb-1">
              {groupListedTransactions(
                upcoming,
                'day',
                {},
                today,
                categoriesById,
              ).map((group) => renderGroup(group, true))}
            </div>
          )}
        </section>
      )}

      {nothing ? (
        <div className="px-6 py-12 text-center">
          <p className="font-medium">
            {filtered ? 'Nada encontrado.' : 'Nenhuma transação ainda.'}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {filtered ? (
              <>
                Nenhuma transação com esses filtros.{' '}
                <Link
                  href={ROUTES.transactions}
                  className="text-foreground underline underline-offset-4"
                >
                  Limpar filtros
                </Link>
              </>
            ) : (
              <>
                Registre pelo botão “Nova transação” ou pelo{' '}
                <Link
                  href={ROUTES.dashboard}
                  className="text-foreground underline underline-offset-4"
                >
                  registro rápido do Início
                </Link>
                .
              </>
            )}
          </p>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground px-4 py-6 text-sm">
          Nada aconteceu ainda nesse período; só há o que está agendado.
        </p>
      ) : (
        <div className="pb-1">
          {groups.map((group) => renderGroup(group, grouping === 'day'))}
        </div>
      )}

      <div ref={sentinelRef} aria-hidden className="h-px" />
      <div aria-live="polite" className="text-muted-foreground text-sm">
        {status === 'loading' && (
          <p className="border-border border-t px-4 py-3">Carregando mais…</p>
        )}
        {status === 'error' && (
          <p className="border-border flex items-center justify-between gap-3 border-t px-4 py-3">
            Não foi possível carregar mais.
            <button
              type="button"
              onClick={() => void loadMore()}
              className="text-foreground underline underline-offset-4"
            >
              Tentar de novo
            </button>
          </p>
        )}
      </div>

      <TransactionEditDialog
        transaction={
          editing && {
            id: editing.id,
            description: editing.description,
            amount: editing.amount,
            day: editing.day,
            categoryId: filed[editing.id] ?? editing.categoryId,
            isInstallment: Boolean(editing.installmentPlanId),
            takesCategory: takesCategory(editing),
          }
        }
        categories={allCategories}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Excluir transação"
        description={
          deleting
            ? `Excluir "${splitOrigin(deleting).description}"? O saldo da conta será ajustado.`
            : ''
        }
        onConfirm={async () => {
          if (deleting) await remove(deleting);
        }}
      />
    </div>
  );
}
