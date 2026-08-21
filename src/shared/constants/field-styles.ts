/**
 * Shared base classes for text-entry form controls (Input, Textarea) so
 * their visual states (default/focus/disabled) never drift apart.
 */
export const FIELD_BASE_CLASSES =
  'border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/20 w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-all duration-200 outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50';
