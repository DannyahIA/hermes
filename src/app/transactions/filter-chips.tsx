'use client';

import { X } from 'lucide-react';

import { TRANSACTION_TYPE_LABELS } from '@/config/constants';
import { cn } from '@/shared/lib/cn';
import { UNCATEGORIZED_FILTER } from '@/shared/lib/transaction-filters';
import type { TransactionQuery } from '@/shared/lib/transaction-query';

interface FilterChipsProps {
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  query: TransactionQuery;
  onRemove: (changes: Partial<TransactionQuery>) => void;
  className?: string;
}

/**
 * One removable chip per account, category or type filter. The period has
 * its own control beside them, and the search its own field.
 */
export function FilterChips({
  accounts,
  categories,
  query,
  onRemove,
  className,
}: FilterChipsProps) {
  const chips: Array<{ key: keyof TransactionQuery; label: string }> = [];

  if (query.accountId) {
    const account = accounts.find((option) => option.id === query.accountId);
    chips.push({
      key: 'accountId',
      label: `Conta: ${account?.name ?? 'removida'}`,
    });
  }
  if (query.categoryId) {
    const category = categories.find(
      (option) => option.id === query.categoryId,
    );
    chips.push({
      key: 'categoryId',
      label:
        query.categoryId === UNCATEGORIZED_FILTER
          ? 'Sem categoria'
          : `Categoria: ${category?.name ?? 'removida'}`,
    });
  }
  if (query.type) {
    chips.push({
      key: 'type',
      label:
        TRANSACTION_TYPE_LABELS[
          query.type as keyof typeof TRANSACTION_TYPE_LABELS
        ] ?? query.type,
    });
  }

  if (chips.length === 0) return null;

  return (
    <ul
      aria-label="Filtros ativos"
      className={cn('flex flex-wrap items-center gap-2', className)}
    >
      {chips.map((chip) => (
        <li key={chip.key}>
          <button
            type="button"
            onClick={() => onRemove({ [chip.key]: undefined })}
            aria-label={`Remover filtro ${chip.label}`}
            className="border-border bg-background hover:bg-accent focus-visible:ring-ring inline-flex max-w-64 items-center gap-1.5 rounded-full border py-1 pr-2 pl-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="truncate">{chip.label}</span>
            <X aria-hidden className="text-muted-foreground size-3 shrink-0" />
          </button>
        </li>
      ))}
    </ul>
  );
}
