import * as React from 'react';

import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';
import { cn } from '@/shared/lib/cn';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(FIELD_BASE_CLASSES, 'flex h-11', className)}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';

export { Input };
