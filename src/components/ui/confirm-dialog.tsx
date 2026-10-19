'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ConfirmDialogProps {
  /** What opens it; leave it out to open it from elsewhere with `open`. */
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
}

/**
 * The single confirmation pattern for destructive actions across the app
 * (ui-ux.md: "Operações destrutivas sempre exigem confirmação"). Wrap any
 * delete button's trigger in this instead of inventing a one-off confirm
 * flow per page.
 */
export function ConfirmDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Excluir',
  onConfirm,
}: ConfirmDialogProps) {
  const [ownOpen, setOwnOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const open = controlledOpen ?? ownOpen;

  function setOpen(next: boolean) {
    setOwnOpen(next);
    onOpenChange?.(next);
  }

  return (
    <>
      {trigger && <span onClick={() => setOpen(true)}>{trigger}</span>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await onConfirm();
                setOpen(false);
              })
            }
          >
            {isPending ? 'Excluindo…' : confirmLabel}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
