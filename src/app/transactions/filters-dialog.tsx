'use client';

import { useEffect, useRef, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  TRANSACTION_TYPE_LABELS,
  type TransactionViewMode,
  VIEW_MODE_LABELS,
} from '@/config/constants';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';
import { UNCATEGORIZED_FILTER } from '@/shared/lib/transaction-filters';
import type { TransactionQuery } from '@/shared/lib/transaction-query';

interface FiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opened from "Personalizado": the dates come first. */
  focusDates: boolean;
  query: TransactionQuery;
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  onApply: (changes: Partial<TransactionQuery>) => void;
  /** The grouping, offered here only on a phone: its toolbar has no room. */
  viewMode: TransactionViewMode;
  onViewModeChange: (mode: TransactionViewMode) => void;
}

const FILTER_KEYS = ['accountId', 'categoryId', 'type', 'from', 'to'] as const;

/** Account, category, type and dates, applied together. */
export function FiltersDialog({
  open,
  onOpenChange,
  ...props
}: FiltersDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <FiltersForm {...props} onClose={() => onOpenChange(false)} />}
    </Dialog>
  );
}

function FiltersForm({
  focusDates,
  query,
  accounts,
  categories,
  onApply,
  viewMode,
  onViewModeChange,
  onClose,
}: Omit<FiltersDialogProps, 'open' | 'onOpenChange'> & {
  onClose: () => void;
}) {
  const fromRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!focusDates) return;
    // After the dialog has opened and put focus on its first field.
    const frame = requestAnimationFrame(() => fromRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [focusDates]);

  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const changes: Partial<TransactionQuery> = {};
    for (const key of FILTER_KEYS) {
      const value = String(data.get(key) ?? '');
      changes[key] = value || undefined;
    }
    if (changes.from && changes.to && changes.from > changes.to) {
      setError('A data inicial vem depois da final.');
      return;
    }
    const mode = data.get('viewMode');
    if (mode && mode !== viewMode) {
      onViewModeChange(mode as TransactionViewMode);
    }
    onApply(changes);
    onClose();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Filtros</DialogTitle>
        <DialogDescription>
          Mostre só as transações de uma conta, categoria, tipo ou período.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={apply} className="space-y-4">
        {error && (
          <Alert variant="error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="filter-account">
            Conta
          </label>
          <select
            id="filter-account"
            name="accountId"
            defaultValue={query.accountId ?? ''}
            className={FIELD_BASE_CLASSES}
          >
            <option value="">Todas as contas</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="filter-category">
              Categoria
            </label>
            <select
              id="filter-category"
              name="categoryId"
              defaultValue={query.categoryId ?? ''}
              className={FIELD_BASE_CLASSES}
            >
              <option value="">Todas as categorias</option>
              <option value={UNCATEGORIZED_FILTER}>Sem categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="filter-type">
              Tipo
            </label>
            <select
              id="filter-type"
              name="type"
              defaultValue={query.type ?? ''}
              className={FIELD_BASE_CLASSES}
            >
              <option value="">Todos os tipos</option>
              {Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="mb-2 text-sm font-medium">Período</legend>
          <label className="space-y-1.5">
            <span className="text-muted-foreground text-xs">De</span>
            <input
              ref={fromRef}
              type="date"
              name="from"
              defaultValue={query.from ?? ''}
              className={FIELD_BASE_CLASSES}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-muted-foreground text-xs">Até</span>
            <input
              type="date"
              name="to"
              defaultValue={query.to ?? ''}
              className={FIELD_BASE_CLASSES}
            />
          </label>
        </fieldset>

        <div className="space-y-2 sm:hidden">
          <label className="text-sm font-medium" htmlFor="filter-view-mode">
            Agrupar
          </label>
          <select
            id="filter-view-mode"
            name="viewMode"
            defaultValue={viewMode}
            className={FIELD_BASE_CLASSES}
          >
            {(Object.keys(VIEW_MODE_LABELS) as TransactionViewMode[]).map(
              (mode) => (
                <option key={mode} value={mode}>
                  {VIEW_MODE_LABELS[mode]}
                </option>
              ),
            )}
          </select>
        </div>

        <DialogFooter className="items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onApply(
                Object.fromEntries(FILTER_KEYS.map((key) => [key, undefined])),
              );
              onClose();
            }}
          >
            Limpar
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">Aplicar</Button>
          </div>
        </DialogFooter>
      </form>
    </>
  );
}
