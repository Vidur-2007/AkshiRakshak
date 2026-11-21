import { XIcon } from 'lucide-react';
import { Dialog as SheetPrimitive } from 'radix-ui';
import type * as React from 'react';
import { cn } from '@/lib/utils';

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;

type Side = 'bottom' | 'right' | 'top' | 'left';

const sideClass: Record<Side, string> = {
  bottom:
    'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-sheet border-t pb-[max(1rem,env(safe-area-inset-bottom))] data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
  top: 'inset-x-0 top-0 rounded-b-sheet border-b data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top',
  right:
    'inset-y-0 right-0 h-full w-[min(26rem,100%)] border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
  left: 'inset-y-0 left-0 h-full w-[min(26rem,100%)] border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left',
};

export function SheetContent({
  className,
  children,
  side = 'bottom',
  closeLabel = 'Close',
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { side?: Side; closeLabel?: string }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          'glass fixed z-50 flex flex-col gap-4 overflow-y-auto p-5 text-text shadow-2xl duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-[250ms]',
          // text on glass needs a ≥72% backing; --glass already is 72%
          sideClass[side],
          className,
        )}
        {...props}
      >
        {side === 'bottom' && (
          <div aria-hidden className="mx-auto -mt-1 h-1.5 w-10 rounded-full bg-overlay/15" />
        )}
        {children}
        <SheetPrimitive.Close
          className="absolute top-3 right-3 inline-flex size-tap items-center justify-center rounded-chip text-text-2 hover:bg-overlay/6 hover:text-text focus-visible:outline-2 focus-visible:outline-brand"
          aria-label={closeLabel}
        >
          <XIcon className="size-5" />
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title className={cn('text-lg font-semibold', className)} {...props} />;
}

export function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description className={cn('text-sm text-text-2', className)} {...props} />;
}
