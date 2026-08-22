import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/shared/lib/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[0_10px_24px_-16px_rgba(15,42,74,0.5)] hover:translate-y-[-1px] hover:bg-primary/90',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-border bg-background hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-[0.3rem] px-3',
        lg: 'h-11 rounded-md px-5',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    if (asChild && React.isValidElement<{ className?: string }>(children)) {
      const childClassName = children.props.className ?? '';

      return React.cloneElement(children, {
        className: cn(
          buttonVariants({ variant, size, className }),
          childClassName,
        ),
      });
    }

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';

export { Button, buttonVariants };
