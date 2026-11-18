import { Toaster as Sonner, type ToasterProps } from 'sonner';

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            '!bg-surface-2 !text-text !border !border-glass-border !rounded-card !shadow-xl !shadow-black/40',
          description: '!text-text-2',
        },
      }}
      {...props}
    />
  );
}
