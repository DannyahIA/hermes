'use client';

import * as React from 'react';

import { cn } from '@/shared/lib/cn';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

/**
 * Built on the native `<dialog>` element instead of a hand-rolled portal —
 * it gets focus trapping, Escape-to-close and a backdrop for free, which
 * matches ui-ux.md's accessibility requirements (keyboard navigation,
 * visible focus) with far less code than reimplementing them.
 */
export function Dialog({ open, onOpenChange, children }: DialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
      onClick={(event) => {
        if (event.target === ref.current) onOpenChange(false);
      }}
      className={cn(
        'dialog-sheet bg-popover text-popover-foreground w-full max-w-md rounded-xl p-5 shadow-[var(--shadow-elevation)] sm:p-6',
        'm-auto max-sm:mb-0 max-sm:max-w-none max-sm:rounded-b-none',
      )}
    >
      {open && children}
    </dialog>
  );
}

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mb-5 flex flex-col gap-1', className)} {...props} />
  );
}

export function DialogTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn('font-display text-base font-semibold', className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-muted-foreground text-sm', className)} {...props} />
  );
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'mt-6 flex flex-wrap items-center justify-end gap-2',
        className,
      )}
      {...props}
    />
  );
}
