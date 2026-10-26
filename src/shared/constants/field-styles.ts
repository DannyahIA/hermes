/**
 * Shared base classes for text-entry form controls (Input, Textarea) so
 * their visual states (default/focus/disabled) never drift apart.
 */
export const FIELD_BASE_CLASSES =
  'border-input bg-card placeholder:text-muted-foreground hover:border-faint-foreground focus-visible:border-ring focus-visible:ring-ring/20 w-full rounded-md border px-3 py-2 text-base shadow-[0_1px_1px_rgb(0_0_0/0.03)] transition-[border-color,box-shadow] duration-[var(--duration-fast)] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/15 sm:text-sm';
