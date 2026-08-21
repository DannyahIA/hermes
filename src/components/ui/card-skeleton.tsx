import { Skeleton } from '@/components/ui/skeleton';

interface CardSkeletonProps {
  lines?: number;
}

/** Approximates a `Card` with a title and N lines of content — used as the
 * `loading.tsx` fallback for dashboard/account/budget summary cards. */
export function CardSkeleton({ lines = 3 }: CardSkeletonProps) {
  return (
    <div className="border-border/70 space-y-3 rounded-xl border p-6">
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className="h-3 w-full" />
      ))}
    </div>
  );
}
