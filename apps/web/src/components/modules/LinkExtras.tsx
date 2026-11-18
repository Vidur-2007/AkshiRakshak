import { CalendarClock, CircleDot, Flag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { UrlFinding } from '@/lib/engine';
import { parseUrl } from '@/lib/urlParts';
import { cn } from '@/lib/utils';

type RedirectChain = NonNullable<UrlFinding['expanded']>;
type DomainAge = NonNullable<UrlFinding['domainAge']>;

/** Vertical timeline of redirect hops; the final domain is emphasised (§5.6, M4.5). */
export function RedirectHops({ chain }: { chain: RedirectChain }) {
  const { t } = useTranslation();
  const hops = chain.hops;
  const finalDomain = parseUrl(chain.finalUrl)?.domain;
  return (
    <div>
      <ol className="relative flex flex-col gap-3 border-l border-glass-border pl-5">
        {hops.map((h, i) => (
          <li key={`${h.url}-${i}`} className="relative">
            <CircleDot
              className="absolute top-0.5 -left-[1.72rem] size-4 bg-surface text-text-2"
              aria-hidden
            />
            <span className="mr-2 rounded-chip border border-glass-border px-1.5 py-0.5 font-mono text-xs text-text-2">
              {h.status}
            </span>
            <span className="font-mono text-sm break-all text-text-2">{h.url}</span>
          </li>
        ))}
        <li className="relative">
          <Flag
            className="absolute top-0.5 -left-[1.72rem] size-4 bg-surface text-brand"
            aria-hidden
          />
          <span className="block text-xs text-text-2">{t('redirect.final')}</span>
          <span className="font-mono text-sm break-all">
            {finalDomain ? (
              <>
                {chain.finalUrl.split(finalDomain)[0]}
                <strong className="font-semibold text-brand">{finalDomain}</strong>
                {chain.finalUrl.split(finalDomain).slice(1).join(finalDomain)}
              </>
            ) : (
              chain.finalUrl
            )}
          </span>
        </li>
      </ol>
      {chain.truncated && <p className="mt-3 text-sm text-text-2">{t('redirect.truncated')}</p>}
      {chain.error && <p className="mt-3 text-sm text-text-2">{t('redirect.error')}</p>}
    </div>
  );
}

export function ageTone(ageDays: number | undefined): 'scam' | 'warn' | 'neutral' {
  if (ageDays === undefined) return 'neutral';
  if (ageDays < 30) return 'scam';
  if (ageDays < 90) return 'warn';
  return 'neutral';
}

/** "Registered 4 days ago" — red under 30 days, amber under 90 (§5.6, M4.6). */
export function DomainAgeBadge({ age }: { age: DomainAge }) {
  const { t } = useTranslation();
  const days = age.ageDays;
  const tone = ageTone(days);
  const text =
    days === undefined || age.error
      ? t('age.unavailable')
      : days < 1
        ? t('age.today')
        : days >= 730
          ? t('age.years', { years: Math.floor(days / 365) })
          : t('age.days', { days });
  return (
    <span
      className={cn(
        'inline-flex h-8 items-center gap-2 rounded-full border px-3 text-sm',
        tone === 'scam' && 'border-risk-scam/50 bg-risk-scam/10 text-text',
        tone === 'warn' && 'border-risk-warn/50 bg-risk-warn/10 text-text',
        tone === 'neutral' && 'border-glass-border bg-surface-2 text-text-2',
      )}
    >
      <CalendarClock
        className={cn(
          'size-4',
          tone === 'scam' ? 'text-risk-scam' : tone === 'warn' ? 'text-risk-warn' : '',
        )}
        aria-hidden
      />
      {text}
      {age.registrar && <span className="hidden text-text-2 sm:inline">· {age.registrar}</span>}
    </span>
  );
}
