import { cn } from '@/shared/lib/cn';

/**
 * Page-level tabs drawn as links over a hairline (Transações | Recorrências,
 * the report sections): the current one is marked by an ink underline and
 * full-strength text, never by colour alone.
 */
export const TAB_LIST_CLASSES = 'border-border flex gap-5 border-b';

export function tabLinkClasses(active: boolean): string {
  return cn(
    'focus-visible:outline-ring -mb-px flex items-baseline gap-2 border-b-2 px-1 py-2.5 text-sm font-medium transition-colors duration-[var(--duration-fast)] focus-visible:outline-2 focus-visible:-outline-offset-2',
    active
      ? 'border-foreground text-foreground'
      : 'text-muted-foreground hover:text-foreground border-transparent',
  );
}
