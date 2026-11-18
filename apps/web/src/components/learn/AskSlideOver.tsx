import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { AskPanel } from './AskPanel';

/** Ask Akshi as a slide-over from the top bar (§5.13); loaded on first open. */
export default function AskSlideOver({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" closeLabel={t('shell.close')} className="w-[min(28rem,100%)]">
        <SheetTitle className="pr-10">{t('page.ask.title')}</SheetTitle>
        <SheetDescription>{t('ask.intro')}</SheetDescription>
        <AskPanel compact />
      </SheetContent>
    </Sheet>
  );
}
