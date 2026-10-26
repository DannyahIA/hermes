import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/shared/lib/cn';

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap select-none transition-[background-color,color,border-color,box-shadow,transform] duration-[var(--duration-fast)] ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] hover:bg-primary/88 active:bg-primary/80',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-accent active:bg-muted',
        outline:
          'border border-border bg-card shadow-[0_1px_1px_rgb(0_0_0/0.03)] hover:bg-accent active:bg-muted',
        ghost:
          'text-muted-foreground hover:bg-accent hover:text-accent-foreground active:bg-muted aria-expanded:bg-accent aria-expanded:text-accent-foreground',
        'destructive-outline':
          'border border-border bg-card text-destructive hover:border-destructive/40 hover:bg-destructive/8 active:bg-destructive/12',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80',
      },
      size: {
        default: 'h-9 px-3.5',
        sm: 'h-8 px-3 text-[0.8125rem]',
        lg: 'h-10 px-4',
        icon: 'size-9',
        'icon-sm': 'size-8',
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
