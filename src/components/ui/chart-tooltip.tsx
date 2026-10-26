'use client';

import type { TooltipContentProps } from 'recharts';

import { formatCurrency } from '@/shared/lib/format-currency';

/**
 * The one tooltip body every chart in the app shares, so hover readouts look
 * the same everywhere and wear this project's card/border/text tokens instead
 * of Recharts' default white box. Values lead (semibold, high contrast) and
 * series names follow in muted ink — in a tooltip the reader already knows
 * which series they're pointing at and wants the number.
 *
 * Props are `Partial` because charts pass this as `content={<ChartTooltipContent />}`:
 * Recharts injects `active`/`payload`/`label` by cloning the element at render
 * time, so they are never supplied at the call site even though they always
 * arrive before the body runs.
 */
export function ChartTooltipContent({
  active,
  payload,
  label,
}: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-inverse text-inverse-foreground min-w-40 rounded-lg px-3 py-2.5 text-sm shadow-[var(--shadow-elevation)]">
      {label !== undefined && (
        <p className="text-inverse-muted mb-1.5 text-xs capitalize">
          {String(label)}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={String(entry.name)} className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block size-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-inverse-muted">{String(entry.name)}</span>
            <span className="dimension-figure ml-auto font-semibold">
              {formatCurrency(Number(entry.value))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
