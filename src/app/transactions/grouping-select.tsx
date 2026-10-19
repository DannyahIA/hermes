'use client';

import { useOptimistic, useTransition } from 'react';

import { setViewPreferenceAction } from '@/app/transactions/preferences-actions';
import { type TransactionViewMode, VIEW_MODE_LABELS } from '@/config/constants';
import { cn } from '@/shared/lib/cn';

interface GroupingSelectProps {
  value: TransactionViewMode;
  className?: string;
}

/**
 * How the list groups its rows — by day, month or category — kept for the
 * user across visits. Saving re-renders the page with the new grouping.
 */
export function GroupingSelect({ value, className }: GroupingSelectProps) {
  const [shown, show] = useOptimistic(value);
  const [isPending, startTransition] = useTransition();

  return (
    <label
      className={cn(
        'text-muted-foreground flex items-center gap-2 text-sm',
        className,
      )}
    >
      Agrupar
      <select
        value={shown}
        disabled={isPending}
        onChange={(event) => {
          const mode = event.target.value as TransactionViewMode;
          startTransition(async () => {
            show(mode);
            await setViewPreferenceAction('transactions', mode);
          });
        }}
        className="border-input bg-background text-foreground focus-visible:ring-ring h-9 rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
      >
        {(Object.keys(VIEW_MODE_LABELS) as TransactionViewMode[]).map(
          (mode) => (
            <option key={mode} value={mode}>
              {VIEW_MODE_LABELS[mode]}
            </option>
          ),
        )}
      </select>
    </label>
  );
}
