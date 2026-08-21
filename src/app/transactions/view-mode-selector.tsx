'use client';

import { useTransition } from 'react';

import { setViewPreferenceAction } from '@/app/transactions/preferences-actions';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';

export type TransactionViewMode =
  'chronological' | 'grouped_by_category' | 'grouped_by_month';

const VIEW_MODE_LABELS: Record<TransactionViewMode, string> = {
  chronological: 'Cronológico',
  grouped_by_category: 'Por categoria',
  grouped_by_month: 'Por mês',
};

/** The full set of valid modes — the single source of truth other modules
 * (e.g. `preferences-actions.ts`'s validation, `page.tsx`'s read-side guard)
 * reuse instead of redefining the union. */
export const TRANSACTION_VIEW_MODES = Object.keys(
  VIEW_MODE_LABELS,
) as TransactionViewMode[];

interface ViewModeSelectorProps {
  value: TransactionViewMode;
}

/** A tiny client island: changing the select persists the choice via
 * `setViewPreferenceAction` and reloads the page (the simplest way to get
 * a Server Component re-render with the new grouping applied, consistent
 * with this app's plain-GET-form-first approach elsewhere). */
export function ViewModeSelector({ value }: ViewModeSelectorProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      aria-label="Modo de visualização"
      className={FIELD_BASE_CLASSES}
      defaultValue={value}
      disabled={isPending}
      onChange={(event) => {
        const mode = event.target.value as TransactionViewMode;
        startTransition(async () => {
          await setViewPreferenceAction('transactions', mode);
          window.location.reload();
        });
      }}
    >
      {(Object.keys(VIEW_MODE_LABELS) as TransactionViewMode[]).map((mode) => (
        <option key={mode} value={mode}>
          {VIEW_MODE_LABELS[mode]}
        </option>
      ))}
    </select>
  );
}
