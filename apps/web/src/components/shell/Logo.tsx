import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';

/** Eye inside a shield. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={cn('size-8', className)}>
      <path
        d="M16 2.5 4.5 6.8v8.4c0 7 4.9 12.4 11.5 14.3 6.6-1.9 11.5-7.3 11.5-14.3V6.8L16 2.5Z"
        fill="var(--surface)"
        stroke="var(--brand)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M8.6 16c2-3.3 4.5-5 7.4-5s5.4 1.7 7.4 5c-2 3.3-4.5 5-7.4 5s-5.4-1.7-7.4-5Z"
        stroke="var(--brand)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16" r="2.4" fill="var(--brand)" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <Link
      to="/"
      aria-label={t('app.logoLabel')}
      className="flex min-h-tap min-w-0 shrink items-center gap-2.5 rounded-chip pr-2 outline-none focus-visible:outline-2 focus-visible:outline-brand"
    >
      <LogoMark />
      {!compact && (
        <span className="truncate font-serif text-[1.6rem] leading-none tracking-[0.04em] whitespace-nowrap">
          {t('app.name')}
        </span>
      )}
    </Link>
  );
}
