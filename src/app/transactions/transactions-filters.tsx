'use client';

import { useRef } from 'react';

import { TRANSACTION_TYPE_LABELS } from '@/config/constants';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';

interface TransactionsFiltersProps {
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  defaultAccountId?: string;
  defaultCategoryId?: string;
  defaultType?: string;
  defaultFrom?: string;
  defaultTo?: string;
}

function toDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? 6 : day - 1; // week starts Monday
  result.setDate(result.getDate() - diff);
  return result;
}

/**
 * A plain GET form — filtering works without any client JS for the core
 * fields, matching ui-ux.md's table requirements (filters/sort/search) with
 * the least amount of code. The period shortcut buttons are the one bit of
 * client interactivity: they just prefill the two date inputs and submit,
 * same end state as typing the dates by hand.
 */
export function TransactionsFilters({
  accounts,
  categories,
  defaultAccountId,
  defaultCategoryId,
  defaultType,
  defaultFrom,
  defaultTo,
}: TransactionsFiltersProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);

  function applyShortcut(from: Date, to: Date) {
    if (fromRef.current) fromRef.current.value = toDateInput(from);
    if (toRef.current) toRef.current.value = toDateInput(to);
    formRef.current?.requestSubmit();
  }

  const today = new Date();

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => applyShortcut(today, today)}
          className="border-input bg-background hover:bg-accent rounded-full border px-3 py-1 text-xs font-medium transition-colors"
        >
          Hoje
        </button>
        <button
          type="button"
          onClick={() => applyShortcut(startOfWeek(today), today)}
          className="border-input bg-background hover:bg-accent rounded-full border px-3 py-1 text-xs font-medium transition-colors"
        >
          Esta semana
        </button>
        <button
          type="button"
          onClick={() =>
            applyShortcut(
              new Date(today.getFullYear(), today.getMonth(), 1),
              today,
            )
          }
          className="border-input bg-background hover:bg-accent rounded-full border px-3 py-1 text-xs font-medium transition-colors"
        >
          Este mês
        </button>
      </div>

      <form
        ref={formRef}
        className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6"
        method="get"
      >
        <select
          name="accountId"
          defaultValue={defaultAccountId ?? ''}
          className={FIELD_BASE_CLASSES}
        >
          <option value="">Todas as contas</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
        <select
          name="categoryId"
          defaultValue={defaultCategoryId ?? ''}
          className={FIELD_BASE_CLASSES}
        >
          <option value="">Todas as categorias</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          name="type"
          defaultValue={defaultType ?? ''}
          className={FIELD_BASE_CLASSES}
        >
          <option value="">Todos os tipos</option>
          {Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          ref={fromRef}
          type="date"
          name="from"
          aria-label="De"
          defaultValue={defaultFrom ?? ''}
          className={FIELD_BASE_CLASSES}
        />
        <input
          ref={toRef}
          type="date"
          name="to"
          aria-label="Até"
          defaultValue={defaultTo ?? ''}
          className={FIELD_BASE_CLASSES}
        />
        <button
          type="submit"
          className="border-input bg-background hover:bg-accent rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
        >
          Filtrar
        </button>
      </form>
    </div>
  );
}
