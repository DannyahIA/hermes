import * as React from 'react';

import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';
import { cn } from '@/shared/lib/cn';

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<'textarea'>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(FIELD_BASE_CLASSES, 'flex min-h-24', className)}
      {...props}
    />
  );
});

Textarea.displayName = 'Textarea';

export { Textarea };
