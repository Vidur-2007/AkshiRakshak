import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type * as React from 'react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-chip text-sm font-medium transition-[background-color,color,box-shadow,transform] duration-150 select-none outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
  {
    variants: {
      variant: {
        default: 'bg-brand text-brand-contrast hover:bg-brand/90',
        // Red only because it leads to emergency help, which is about scam risk.
        danger: 'bg-risk-scam text-white hover:bg-risk-scam/90',
        outline: 'border border-glass-border bg-transparent text-text hover:bg-white/6',
        secondary: 'bg-surface-2 text-text hover:bg-surface-2/80 border border-glass-border',
        ghost: 'text-text-2 hover:bg-white/6 hover:text-text',
        link: 'text-brand underline-offset-4 hover:underline',
      },
      size: {
        default: 'min-h-tap px-4 py-2',
        sm: 'min-h-9 px-3 text-sm',
        lg: 'min-h-12 px-6 text-base',
        icon: 'size-tap',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
