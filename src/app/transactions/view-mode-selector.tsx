'use client';

import { useTransition } from 'react';

import { setViewPreferenceAction } from '@/app/transactions/preferences-actions';
import { type TransactionViewMode, VIEW_MODE_LABELS } from '@/config/constants';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';

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
