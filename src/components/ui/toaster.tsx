'use client';

import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';

import { dismissToast, useToasts } from '@/shared/hooks/use-toast';
import { cn } from '@/shared/lib/cn';

const VARIANT_STYLES = {
  default: 'border-border bg-card text-card-foreground',
  success: 'border-success/30 bg-success/10 text-success-foreground',
  warning: 'border-warning/30 bg-warning/10 text-warning-foreground',
  error: 'border-destructive/30 bg-destructive/10 text-destructive-foreground',
} as const;

const VARIANT_ICONS = {
  default: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: XCircle,
} as const;

/**
 * Mounted once in the root layout. Every async action's feedback
 * (ui-ux.md's Feedback principle) should call `toast(...)` from
 * `@/shared/hooks/use-toast` rather than inventing a local success/error
 * message element.
 */
export function Toaster() {
  const toasts = useToasts();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const Icon = VARIANT_ICONS[t.variant];
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              'flex items-start gap-3 rounded-lg border p-4 shadow-[var(--shadow-elevation)]',
              VARIANT_STYLES[t.variant],
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-medium">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 opacity-80">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => dismissToast(t.id)}
              aria-label="Fechar notificação"
              className="opacity-60 transition-opacity hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
