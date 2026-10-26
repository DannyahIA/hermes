'use client';

import {
  ArrowLeftRight,
  CreditCard,
  Ellipsis,
  type LucideIcon,
  Vault,
  Wallet,
} from 'lucide-react';

import {
  CategoryDot,
  type CategoryOption,
  CategoryPicker,
} from '@/app/dashboard/category-picker';
import { Menu, MenuItem } from '@/components/ui/menu';
import type { NewCategoryHint } from '@/modules/categories/domain/category-catalog';
import { cn } from '@/shared/lib/cn';
import { formatCurrency } from '@/shared/lib/format-currency';
import { splitOrigin } from '@/shared/lib/transaction-origin';

import { type ListedTransaction, takesCategory } from './listed-transaction';

export interface AccountOption {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit';
}

export const ACCOUNT_ICONS: Record<AccountOption['type'], LucideIcon> = {
  checking: Wallet,
  savings: Vault,
  credit: CreditCard,
};

/**
 * One line per transaction on a wide list, two on a narrow one. The
 * columns come from the list (`--lead` is the first one's width), so every
 * row lines up with the others; on a narrow list the category, account and
 * time fold into a second line.
 */
const ROW_GRID =
  'grid grid-cols-[minmax(0,1fr)_auto_2rem] items-center gap-x-3 gap-y-0.5 @3xl:grid-cols-[var(--lead)_minmax(0,1fr)_minmax(0,0.6fr)_minmax(0,0.6fr)_8.75rem_2rem] @3xl:gap-x-4';

export function signedAmount(
  amount: number,
  sign: 'in' | 'out' | 'none',
): string {
  const prefix = sign === 'in' ? '+ ' : sign === 'out' ? '− ' : '';
  return `${prefix}${formatCurrency(amount)}`;
}

interface TransactionRowProps {
  transaction: ListedTransaction;
  category?: CategoryOption;
  account?: AccountOption;
  /** The card a bill payment settles. */
  settledCard?: AccountOption;
  /** The time within a day's group; the date in a month's or category's. */
  lead: { text: string; isTime: boolean } | null;
  suggestions: CategoryOption[];
  /** A common category the user does not have yet, offered first. */
  newCategory?: NewCategoryHint;
  /** The categories it can be filed under now. */
  categories: CategoryOption[];
  picking: boolean;
  /** A new category for it is being saved: "Sem categoria" waits. */
  creating: boolean;
  onTogglePicking: () => void;
  onPick: (category: CategoryOption) => void;
  onCreate: (name: string, color?: string) => void;
  /** Absent for a transfer, which is deleted and made again instead. */
  onEdit?: () => void;
  onDelete: () => void;
}

export function TransactionRow({
  transaction,
  category,
  account,
  settledCard,
  lead,
  suggestions,
  newCategory,
  categories,
  picking,
  creating,
  onTogglePicking,
  onPick,
  onCreate,
  onEdit,
  onDelete,
}: TransactionRowProps) {
  const { description, origin } = splitOrigin(transaction);
  const between = !takesCategory(transaction);
  const sign =
    transaction.type === 'income'
      ? 'in'
      : transaction.type === 'expense'
        ? 'out'
        : 'none';
  const AccountIcon = account ? ACCOUNT_ICONS[account.type] : Wallet;

  return (
    <li className="border-border hover:bg-subtle border-b transition-colors duration-[var(--duration-fast)] last:border-b-0">
      <div className={cn(ROW_GRID, 'px-4 py-2.5')}>
        <p className="col-start-1 row-start-1 flex min-w-0 items-baseline gap-2 @3xl:col-start-2">
          <span className="truncate" title={description}>
            {description}
          </span>
          {origin && (
            <span className="text-muted-foreground hidden shrink-0 text-xs @3xl:inline">
              {origin}
            </span>
          )}
        </p>

        <p
          className={cn(
            'dimension-figure col-start-2 row-start-1 text-right whitespace-nowrap @3xl:col-start-5',
            !between && sign === 'in' && 'text-success',
            !between && sign === 'out' && 'text-destructive',
          )}
        >
          {signedAmount(transaction.amount, sign)}
        </p>

        {/* A second line on a narrow list, its parts told apart by their
            marks; separate columns on a wide one. The category keeps its
            room there, and the account's name gives way. */}
        <div className="text-muted-foreground col-span-2 col-start-1 row-start-2 flex min-w-0 items-center gap-x-3 text-xs @3xl:contents @3xl:text-sm">
          <span className="flex max-w-[55%] min-w-0 shrink-0 items-center gap-1.5 @3xl:col-start-3 @3xl:row-start-1 @3xl:max-w-none">
            {category ? (
              <>
                <CategoryDot color={category.color} />
                <span className="truncate" title={category.name}>
                  {category.name}
                </span>
              </>
            ) : transaction.type === 'transfer' ? (
              <>
                <ArrowLeftRight aria-hidden className="size-3.5 shrink-0" />
                <span className="truncate">Transferência</span>
              </>
            ) : between ? (
              <>
                <CreditCard aria-hidden className="size-3.5 shrink-0" />
                <span
                  className="truncate"
                  title={`Fatura ${settledCard?.name ?? 'do cartão'}`}
                >
                  Fatura {settledCard?.name ?? 'do cartão'}
                </span>
              </>
            ) : (
              <button
                type="button"
                aria-expanded={picking}
                disabled={creating}
                onClick={onTogglePicking}
                className="border-input hover:border-foreground hover:text-foreground focus-visible:ring-ring bg-muted/50 shrink-0 rounded border px-1.5 py-0.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                Sem categoria
              </button>
            )}
          </span>

          <span className="flex min-w-0 flex-1 items-center gap-1.5 @3xl:col-start-4 @3xl:row-start-1">
            <AccountIcon aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate" title={account?.name}>
              {account?.name ?? 'Conta removida'}
            </span>
          </span>

          {/* On a narrow list the mark leaves the name its room; what an
              installment or a recurrence writes has no time to share the
              line with. */}
          {origin && (
            <span className="shrink-0 whitespace-nowrap @3xl:hidden">
              {origin}
            </span>
          )}
          {lead && (
            <span
              className={cn(
                'shrink-0 whitespace-nowrap @3xl:col-start-1 @3xl:row-start-1',
                // A time reads as a figure; a date as words.
                lead.isTime && 'dimension-figure',
              )}
            >
              {lead.text}
            </span>
          )}
        </div>

        <div className="col-start-3 row-span-2 row-start-1 justify-self-end @3xl:col-start-6 @3xl:row-span-1">
          <Menu
            label={`Ações de ${description}`}
            trigger={<Ellipsis aria-hidden className="size-4" />}
            triggerClassName="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring aria-expanded:bg-accent inline-flex size-8 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            {onEdit && <MenuItem onSelect={onEdit}>Editar</MenuItem>}
            <MenuItem destructive onSelect={onDelete}>
              Excluir
            </MenuItem>
          </Menu>
        </div>
      </div>

      {picking && !category && !between && (
        <CategoryPicker
          className="px-4 pb-3 @3xl:pl-[calc(var(--lead)+2rem)]"
          subject={description}
          suggestions={suggestions}
          newCategory={newCategory}
          categories={categories}
          onPick={onPick}
          onCreate={onCreate}
        />
      )}
    </li>
  );
}
