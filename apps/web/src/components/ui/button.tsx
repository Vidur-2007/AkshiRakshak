import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Buttons are pills (design 2026-11-20): ink for the main action, cyan for "try it", liquid glass
 * for the rest. The glass colours come from the theme tokens, so they work by day and by night.
 */
const glassPill =
  'border border-[var(--pill-border)] bg-[var(--pill-bg)] text-text backdrop-blur-[14px] backdrop-saturate-[1.8] shadow-[inset_0_1px_0_var(--pill-highlight),0_10px_30px_-14px_rgb(0_0_0/0.35)] hover:border-overlay/30';

export const buttonVariants = cva(
  'inline-flex min-w-0 max-w-full items-center justify-center gap-2 rounded-full text-center text-sm font-medium transition-[background-color,color,box-shadow,border-color,transform] duration-150 select-none outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
  {
    variants: {
      variant: {
        default:
          'bg-ink-fill text-ink-fill-text hover:bg-ink-fill/90 shadow-[0_10px_30px_-14px_rgb(0_0_0/0.45)]',
        cyan: 'border border-white/60 bg-cyan text-[#04121a] hover:bg-cyan/90 shadow-[0_0_24px_-8px_var(--cyan)]',
        // Red only because it leads to emergency help, which is about scam risk.
        danger: 'bg-risk-scam-solid text-white hover:bg-risk-scam-solid/90',
        outline: glassPill,
        secondary: glassPill,
        ghost: 'text-text-2 hover:bg-overlay/6 hover:text-text',
        link: 'rounded-chip text-brand underline-offset-4 hover:underline',
      },
      size: {
        default: 'min-h-tap px-5 py-2',
        sm: 'min-h-9 px-4 text-sm',
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
