import { cn } from '@/shared/lib/cn';

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  /** The page's own actions — at most one primary, the rest quiet. */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Every page's title row. The `h1` is marked `data-page-title` so the shell
 * can bring the title into its header once this one scrolls out of view
 * (the iOS "large title" behaviour) instead of showing it twice.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-end justify-between gap-x-6 gap-y-3',
        className,
      )}
    >
      <div className="min-w-0">
        <h1
          data-page-title
          className="font-display text-title font-semibold text-balance"
        >
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground mt-1 max-w-prose text-sm">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
