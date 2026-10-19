'use client';

import { useOptimistic, useState, useTransition } from 'react';

import { toast } from '@/shared/hooks/use-toast';
import { cn } from '@/shared/lib/cn';
import { formatCurrency } from '@/shared/lib/format-currency';

import { categorizeTransactionAction } from './actions';
import {
  CategoryDot,
  type CategoryOption,
  CategoryPicker,
} from './category-picker';

export interface RecentRow {
  id: string;
  description: string;
  /** How the transaction came in when not typed by hand: "Parcela 3/10". */
  origin?: string;
  categoryId?: string;
  accountName: string;
  /** Null for an entry stored at midnight. */
  time: string | null;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  /** The card a bill payment settles, by name; such a row takes no category. */
  settles?: string;
  suggestions: CategoryOption[];
}

export interface RecentDayView {
  key: string;
  /** "Hoje", "Ontem", "seg., 13 de out." */
  label: string;
  net: number;
  rows: RecentRow[];
}

interface RecentTransactionsProps {
  days: RecentDayView[];
  /** Every category, archived ones too, to name what's already filed. */
  categoriesById: Record<string, CategoryOption>;
  /** The categories a transaction can be filed under now. */
  categories: CategoryOption[];
}

function signed(amount: number, type: RecentRow['type']): string {
  const sign = type === 'income' ? '+ ' : type === 'expense' ? '− ' : '';
  return `${sign}${formatCurrency(amount)}`;
}

/**
 * The latest transactions by day, each day with its total (spec
 * 2026-10-17-inicio-hub-design.md §4.6). "Sem categoria" opens the same
 * one-tap picker as "Para revisar", right on the row.
 */
export function RecentTransactions({
  days,
  categoriesById,
  categories,
}: RecentTransactionsProps) {
  const [filed, file] = useOptimistic(
    {} as Record<string, string>,
    (current, { id, categoryId }: { id: string; categoryId: string }) => ({
      ...current,
      [id]: categoryId,
    }),
  );
  const [picking, setPicking] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function pick(row: RecentRow, category: CategoryOption) {
    setPicking(null);
    startTransition(async () => {
      file({ id: row.id, categoryId: category.id });
      const result = await categorizeTransactionAction(row.id, category.id);
      if (!result.success) {
        toast({
          title: result.error ?? 'Não foi possível salvar a categoria.',
          variant: 'error',
        });
      }
    });
  }

  return (
    <div>
      {days.map((day, index) => (
        <section key={day.key} aria-label={day.label}>
          <div
            className={cn(
              'border-border flex items-baseline justify-between gap-3 border-b pb-1.5 text-sm',
              index > 0 && 'mt-5',
            )}
          >
            <h4 className="font-medium">{day.label}</h4>
            {Math.abs(day.net) >= 0.005 && (
              <span className="dimension-figure text-muted-foreground whitespace-nowrap">
                {signed(Math.abs(day.net), day.net > 0 ? 'income' : 'expense')}
              </span>
            )}
          </div>
          <ul>
            {day.rows.map((row) => {
              const categoryId = filed[row.id] ?? row.categoryId;
              const category = categoryId
                ? categoriesById[categoryId]
                : undefined;

              return (
                <li key={row.id} className="dimension-row block">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="flex min-w-0 items-baseline gap-2">
                      <span className="truncate" title={row.description}>
                        {row.description}
                      </span>
                      {row.origin && (
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {row.origin}
                        </span>
                      )}
                    </p>
                    <p
                      className={cn(
                        'dimension-figure shrink-0 whitespace-nowrap',
                        row.type === 'income' && 'text-success',
                        row.type === 'expense' && 'text-destructive',
                      )}
                    >
                      {signed(row.amount, row.type)}
                    </p>
                  </div>
                  <p className="text-muted-foreground mt-0.5 flex min-w-0 items-center gap-1.5 text-xs">
                    {category ? (
                      <span className="flex min-w-0 shrink items-center gap-1.5">
                        <CategoryDot color={category.color} />
                        <span className="truncate">{category.name},</span>
                      </span>
                    ) : row.type === 'transfer' ? (
                      <span>Transferência,</span>
                    ) : row.settles !== undefined ? (
                      <span className="truncate">Fatura {row.settles},</span>
                    ) : (
                      <button
                        type="button"
                        aria-expanded={picking === row.id}
                        onClick={() =>
                          setPicking(picking === row.id ? null : row.id)
                        }
                        className="border-muted-foreground/50 hover:border-foreground hover:text-foreground focus-visible:ring-ring shrink-0 rounded border border-dashed px-1.5 py-0.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      >
                        Sem categoria
                      </button>
                    )}
                    <span className="truncate">
                      {row.accountName}
                      {row.time && `, ${row.time}`}
                    </span>
                  </p>
                  {picking === row.id && !category && !row.settles && (
                    <CategoryPicker
                      className="mt-2"
                      subject={row.description}
                      suggestions={row.suggestions}
                      categories={categories}
                      onPick={(picked) => pick(row, picked)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
