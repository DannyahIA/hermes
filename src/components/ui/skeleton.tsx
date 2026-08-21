import * as React from 'react';

import { cn } from '@/shared/lib/cn';

const Skeleton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('bg-muted/70 animate-pulse rounded-lg', className)}
    {...props}
  />
));
Skeleton.displayName = 'Skeleton';

export { Skeleton };
