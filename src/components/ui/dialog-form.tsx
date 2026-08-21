'use client';

import * as React from 'react';

import { Dialog, type DialogProps } from '@/components/ui/dialog';

interface DialogFormRenderArgs<State> {
  state: State;
  formAction: (formData: FormData) => void;
}

export interface DialogFormProps<
  State extends { success: boolean },
> extends Pick<DialogProps, 'open' | 'onOpenChange'> {
  action: (state: State, formData: FormData) => Promise<State>;
  initialState: State;
  /** Called in addition to the automatic close-on-success, e.g. for a toast. */
  onSuccess?: (state: State) => void;
  /**
   * Whether `state.success` should auto-close the dialog. Defaults to `true`
   * (Round 1 behavior). Set `false` when "success" means "ready for a next
   * step within the same dialog" rather than "done" — e.g. a preview step
   * that hands off to a confirm step, both rendered inside one open dialog.
   */
  closeOnSuccess?: boolean;
  children: (args: DialogFormRenderArgs<State>) => React.ReactNode;
}

/**
 * Wraps `Dialog` + `useActionState` so every dialog-with-a-form gets a
 * correct reset-on-reopen for free. `Dialog` already unmounts its children
 * when closed (`{open && children}`) — the bug this fixes was every caller
 * declaring `useActionState` *above* that boundary, in a parent that never
 * unmounts, so a stale `state.success === true` from a previous submission
 * re-closed the dialog the instant it reopened. Declaring `useActionState`
 * inside `DialogFormInner`, which only exists while `open` is true, makes
 * its state naturally reborn on every open. The close-on-success is a
 * `useEffect` (runs after commit) instead of a render-phase side effect.
 */
export function DialogForm<State extends { success: boolean }>({
  open,
  onOpenChange,
  action,
  initialState,
  onSuccess,
  closeOnSuccess = true,
  children,
}: DialogFormProps<State>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogFormInner
          action={action}
          initialState={initialState}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
          closeOnSuccess={closeOnSuccess}
        >
          {children}
        </DialogFormInner>
      )}
    </Dialog>
  );
}

function DialogFormInner<State extends { success: boolean }>({
  action,
  initialState,
  onClose,
  onSuccess,
  closeOnSuccess,
  children,
}: {
  action: (state: State, formData: FormData) => Promise<State>;
  initialState: State;
  onClose: () => void;
  onSuccess?: (state: State) => void;
  closeOnSuccess: boolean;
  children: (args: DialogFormRenderArgs<State>) => React.ReactNode;
}) {
  // `useActionState`'s declaration types the reducer over `Awaited<State>`,
  // which TS cannot prove equals `State` for a generic `State` even though
  // this component's `State` is never itself a promise (it extends
  // `{ success: boolean }`). The cast is compiler-only — the values that
  // flow through at runtime are unchanged.
  const [state, formAction] = React.useActionState(
    action as (
      state: Awaited<State>,
      payload: FormData,
    ) => State | Promise<State>,
    initialState as Awaited<State>,
  );

  React.useEffect(() => {
    if (state.success) {
      if (closeOnSuccess) onClose();
      onSuccess?.(state);
    }
    // Only react to a transition into success — onClose/onSuccess/closeOnSuccess
    // identity changing on every parent render must not re-trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return children({ state, formAction });
}
