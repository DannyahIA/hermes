import type { ReactNode } from 'react';
import { useTransition } from 'react';

import { type Toast, toast } from '@/shared/hooks/use-toast';

/** Runs one action for one line, so only that line's button waits. */
export function useLineAction() {
  const [isPending, startTransition] = useTransition();
  function run(action: () => Promise<Omit<Toast, 'id'>>) {
    startTransition(async () => {
      toast(await action());
    });
  }
  return { isPending, run };
}

export function SuggestionLine({
  text,
  button,
  children,
}: {
  text: ReactNode;
  button: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
      <p className="text-sm">{text}</p>
      {button}
      {children}
    </li>
  );
}
