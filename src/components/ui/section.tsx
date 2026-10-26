import Link from 'next/link';
import * as React from 'react';

import { cn } from '@/shared/lib/cn';

/**
 * An open block of content on the canvas: a heading row and what follows,
 * with no box around it. Use it where a card would only add an edge — a
 * list, a chart, a short summary — and keep `Card` for content that needs
 * to read as one object (an account, a loan, the headline figure). Stacked
 * sections are separated by hairlines (`divide-y divide-border` on the
 * parent), the way a grouped table separates its groups.
 */
const Section = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, ...props }, ref) => (
  <section
    ref={ref}
    className={cn('flex min-w-0 flex-col', className)}
    {...props}
  />
));
Section.displayName = 'Section';

interface SectionHeaderProps {
  title: React.ReactNode;
  /** A count beside the title: "Para revisar 3". */
  count?: number;
  description?: React.ReactNode;
  /** One quiet action on the right — usually a `SectionLink`. */
  action?: React.ReactNode;
  className?: string;
}

function SectionHeader({
  title,
  count,
  description,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn('mb-3 flex items-start justify-between gap-4', className)}
    >
      <div className="min-w-0">
        <h2 className="font-display text-heading flex items-baseline gap-2 font-semibold">
          {title}
          {count !== undefined && (
            <span className="dimension-figure text-muted-foreground text-sm font-normal">
              {count}
            </span>
          )}
        </h2>
        {description && (
          <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0 pt-0.5">{action}</div>}
    </div>
  );
}

/** The quiet "Ver todas" / "Relatórios" link in a section's header row. */
function SectionLink({
  className,
  ...props
}: React.ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        'text-muted-foreground hover:text-foreground focus-visible:outline-ring rounded-sm text-sm font-medium transition-colors duration-[var(--duration-fast)] focus-visible:outline-2 focus-visible:outline-offset-2',
        className,
      )}
      {...props}
    />
  );
}

export { Section, SectionHeader, SectionLink };
