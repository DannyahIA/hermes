'use client';

import { Check, Info, TriangleAlert, X } from 'lucide-react';

import { dismissToast, useToasts } from '@/shared/hooks/use-toast';
import { cn } from '@/shared/lib/cn';

// Toasts are drawn in ink — the inverse of the page (black on a light page,
// white on a dark one) — so a passing message is unmistakable without
// covering anything for long. State is carried twice: by the badge colour
// and by the glyph inside it, never by colour alone.
const VARIANT_BADGE_STYLES = {
  default: 'bg-info text-info-foreground',
  success: 'bg-success text-success-foreground',
  warning: 'bg-warning text-warning-foreground',
  error: 'bg-destructive text-destructive-foreground',
} as const;

const VARIANT_ICONS = {
  default: Info,
  success: Check,
  warning: TriangleAlert,
  error: X,
} as const;

/**
 * Mounted once in the root layout. Every async action's feedback
 * (ui-ux.md's Feedback principle) should call `toast(...)` from
 * `@/shared/hooks/use-toast` rather than inventing a local success/error
 * message element.
 */
export function Toaster() {
  const toasts = useToasts();

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 bottom-3 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:items-end"
    >
      {toasts.map((t) => {
        const Icon = VARIANT_ICONS[t.variant];
        return (
          <div
            key={t.id}
            role={t.variant === 'error' ? 'alert' : 'status'}
            className="toast-in bg-inverse text-inverse-foreground pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-[0.875rem] py-2.5 pr-2.5 pl-3 shadow-[var(--shadow-elevation)]"
          >
            <span
              data-toast-icon
              aria-hidden
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full',
                VARIANT_BADGE_STYLES[t.variant],
              )}
            >
              <Icon className="size-3.5 [stroke-width:2.5]" />
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">{t.title}</p>
              {t.description && (
                <p className="text-inverse-muted mt-0.5 text-[0.8125rem]">
                  {t.description}
                </p>
              )}
            </div>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  dismissToast(t.id);
                }}
                className="bg-inverse-foreground/12 hover:bg-inverse-foreground/20 focus-visible:outline-ring h-7 shrink-0 rounded-md px-2.5 text-[0.8125rem] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              aria-label="Fechar notificação"
              className="text-inverse-muted hover:text-inverse-foreground focus-visible:outline-ring flex size-7 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-2"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
