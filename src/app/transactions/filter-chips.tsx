import Link from 'next/link';

import { TRANSACTION_TYPE_LABELS } from '@/config/constants';

interface FilterChipsProps {
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  filters: {
    accountId?: string;
    categoryId?: string;
    type?: string;
    from?: string;
    to?: string;
  };
}

/**
 * One removable chip per active transaction-list filter. Each chip links to
 * the current query string with just that key removed — no client JS
 * needed, consistent with `TransactionsFilters` being a plain GET form.
 */
export function FilterChips({
  accounts,
  categories,
  filters,
}: FilterChipsProps) {
  const chips: Array<{
    key: keyof FilterChipsProps['filters'];
    label: string;
  }> = [];

  if (filters.accountId) {
    const account = accounts.find((a) => a.id === filters.accountId);
    chips.push({ key: 'accountId', label: `Conta: ${account?.name ?? '—'}` });
  }
  if (filters.categoryId) {
    const category = categories.find((c) => c.id === filters.categoryId);
    chips.push({
      key: 'categoryId',
      label: `Categoria: ${category?.name ?? '—'}`,
    });
  }
  if (filters.type) {
    chips.push({
      key: 'type',
      label:
        TRANSACTION_TYPE_LABELS[
          filters.type as keyof typeof TRANSACTION_TYPE_LABELS
        ] ?? filters.type,
    });
  }
  if (filters.from || filters.to) {
    chips.push({
      key: 'from',
      label: `${filters.from ?? '…'} – ${filters.to ?? '…'}`,
    });
  }

  if (chips.length === 0) return null;

  return (
    <div
      className="flex flex-wrap gap-2"
      role="list"
      aria-label="Filtros ativos"
    >
      {chips.map((chip) => {
        const params = new URLSearchParams();
        if (filters.accountId && chip.key !== 'accountId')
          params.set('accountId', filters.accountId);
        if (filters.categoryId && chip.key !== 'categoryId')
          params.set('categoryId', filters.categoryId);
        if (filters.type && chip.key !== 'type')
          params.set('type', filters.type);
        // "from" chip represents both from/to together — removing it clears both.
        if (chip.key !== 'from') {
          if (filters.from) params.set('from', filters.from);
          if (filters.to) params.set('to', filters.to);
        }

        return (
          <Link
            key={chip.key}
            href={`?${params.toString()}`}
            className="border-input bg-background hover:bg-accent inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
          >
            {chip.label}
            <span aria-hidden>×</span>
          </Link>
        );
      })}
    </div>
  );
}
