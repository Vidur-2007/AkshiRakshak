import { Siren } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';

/** Red pill "I think I'm being scammed" → /sos. Red because it is about scam risk. */
export function SosPill({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <Link
      to="/sos"
      aria-label={t('shell.sosPill')}
      className={cn(
        'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full bg-risk-scam px-4 text-sm font-semibold text-white shadow-[0_0_0_1px_rgb(255_59_92/0.4)] transition-[background-color,transform] duration-150 hover:bg-risk-scam/90 active:scale-[0.97] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        className,
      )}
    >
      <Siren className="size-4" aria-hidden />
      <span className="hidden whitespace-nowrap xl:inline">{t('shell.sosPill')}</span>
      <span className="xl:hidden">{t('nav.sosShort')}</span>
    </Link>
  );
}

/** Compact SOS button pinned top-right on mobile. */
export function SosFab({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <Link
      to="/sos"
      aria-label={t('shell.sosPill')}
      className={cn(
        'inline-flex min-h-tap min-w-tap items-center justify-center gap-1.5 rounded-full bg-risk-scam px-3.5 text-sm font-bold tracking-wide text-white shadow-lg shadow-black/40 active:scale-[0.97] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        className,
      )}
    >
      <Siren className="size-4" aria-hidden />
      {t('nav.sosShort')}
    </Link>
  );
}
