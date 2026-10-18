'use client';

import { useEffect, useState } from 'react';

export type ToastVariant = 'default' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  /** One follow-up, like "Desfazer". Clicking it also dismisses the toast. */
  action?: { label: string; onClick: () => void };
}

type Listener = (toasts: Toast[]) => void;

/**
 * A minimal module-level store instead of a Context provider — toasts are
 * fired from anywhere (server-action result handlers, client components)
 * without needing every caller wrapped in a provider tree.
 */
let toasts: Toast[] = [];
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener(toasts));
}

/** Long enough to read; longer when there's an action to reach for. */
const DURATION_MS = 5000;
const DURATION_WITH_ACTION_MS = 8000;

export function toast(input: Omit<Toast, 'id'>): void {
  const id = crypto.randomUUID();
  toasts = [...toasts, { ...input, id }];
  emit();

  setTimeout(
    () => {
      toasts = toasts.filter((t) => t.id !== id);
      emit();
    },
    input.action ? DURATION_WITH_ACTION_MS : DURATION_MS,
  );
}

export function dismissToast(id: string): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function useToasts(): Toast[] {
  const [state, setState] = useState<Toast[]>(toasts);

  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return state;
}
