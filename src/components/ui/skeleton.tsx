import { cn } from '@/shared/lib/cn';

/** A single pulsing placeholder block — compose with width/height utility classes. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-muted animate-pulse rounded-md', className)} />;
}
