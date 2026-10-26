interface EmptyStateProps {
  title: string;
  description: string;
  /** A `Button`/`Link` element, if this empty state should offer a next
   * action — omit for read-only contexts (e.g. a report section with no
   * data yet, where there's nothing to "create" from that exact spot). */
  action?: React.ReactNode;
}

/**
 * The shared shape every "no data yet" screen in the app should use —
 * consolidates markup that existed as three near-identical, independently
 * drifting `<Card>` blocks across `/loans`, `/categories`, and `/reports`
 * before this component existed. Treats absence of data as an invitation
 * to act, not an error (ui-ux.md).
 */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="bg-subtle border-border flex flex-col items-center gap-1.5 rounded-lg border px-6 py-10 text-center">
      <p className="font-display text-heading font-semibold">{title}</p>
      <p className="text-muted-foreground max-w-sm text-sm">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
