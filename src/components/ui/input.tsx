import * as React from 'react';

import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          'border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/20 flex h-11 w-full rounded-2xl border px-3 py-2 text-sm shadow-sm transition-all duration-200 outline-none focus-visible:ring-2',
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';

export { Input };
