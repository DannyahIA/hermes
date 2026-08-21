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
        'bg-card text-card-foreground w-full max-w-md rounded-xl p-6 shadow-[var(--shadow-elevation)]',
        'backdrop:bg-slate-950/50 backdrop:backdrop-blur-sm',
        'm-auto',
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
  return <div className={cn('mb-4 space-y-1.5', className)} {...props} />;
}

export function DialogTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn('font-display text-lg font-semibold', className)}
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
    <div className={cn('mt-6 flex justify-end gap-2', className)} {...props} />
  );
}
