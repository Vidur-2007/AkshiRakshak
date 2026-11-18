import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { ElderToggle } from './ElderToggle';
import { LanguageSwitcher } from './LanguageSwitcher';
import { LEARN, MODULES, NETWORK, SETTINGS, TOUR, type NavItem } from './nav';

function SheetLink({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const { t } = useTranslation();
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      className="tap flex min-h-tap items-center gap-3 rounded-chip px-3 py-2 text-text hover:bg-white/6 outline-none focus-visible:outline-2 focus-visible:outline-brand"
    >
      <item.icon className="size-5 shrink-0 text-brand" aria-hidden />
      <span className="flex flex-col">
        <span className="font-medium">{t(`nav.${item.key}`)}</span>
        {item.descKey && (
          <span className="text-xs text-text-2">{t(`navDesc.${item.descKey}`)}</span>
        )}
      </span>
    </Link>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="px-3 text-xs font-medium tracking-wide text-text-2 uppercase">{title}</h3>
      {children}
    </section>
  );
}

/** Mobile "More" sheet: Modules, Learn, Network, Settings, language, Elder mode. */
export function MoreSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange(o: boolean): void;
}) {
  const { t } = useTranslation();
  const close = () => onOpenChange(false);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" closeLabel={t('shell.close')} className="gap-5">
        <div>
          <SheetTitle>{t('shell.moreTitle')}</SheetTitle>
          <SheetDescription className="sr-only">{t('app.tagline')}</SheetDescription>
        </div>
        <Section title={t('nav.modules')}>
          {MODULES.map((m) => (
            <SheetLink key={m.to} item={m} onNavigate={close} />
          ))}
        </Section>
        <Section title={t('nav.learn')}>
          {LEARN.map((m) => (
            <SheetLink key={m.to} item={m} onNavigate={close} />
          ))}
        </Section>
        <Section title={t('nav.more')}>
          <SheetLink item={NETWORK} onNavigate={close} />
          <SheetLink item={SETTINGS} onNavigate={close} />
          <SheetLink item={TOUR} onNavigate={close} />
        </Section>
        <div className="flex flex-col gap-3 border-t border-glass-border pt-4">
          <LanguageSwitcher full className="w-full" />
          <ElderToggle showHint className="justify-between px-1" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
