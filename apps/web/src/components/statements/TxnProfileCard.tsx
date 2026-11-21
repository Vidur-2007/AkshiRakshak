import { useTranslation } from 'react-i18next';
import { inr } from '@/lib/charts';
import type { Anomaly, StatementAnalysis } from '@/lib/engine';
import { profileOf } from '@/lib/txnProfile';
import { cn } from '@/lib/utils';

/** Tone of a fact: red when it stands out, amber when it is a little off, plain otherwise. */
const tone = (level: 'high' | 'mid' | 'none') =>
  level === 'high' ? 'text-risk-scam' : level === 'mid' ? 'text-risk-warn' : 'text-text';

function Tile({
  label,
  value,
  note,
  level = 'none',
}: {
  label: string;
  value: string;
  note?: string;
  level?: 'high' | 'mid' | 'none';
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-card border border-glass-border bg-surface p-3">
      <dt className="text-xs text-text-2">{label}</dt>
      <dd className="m-0">
        <span className={cn('font-serif text-xl leading-tight tabular-nums', tone(level))}>
          {value}
        </span>
        {note && <span className={cn('block text-xs font-medium', tone(level))}>{note}</span>}
      </dd>
    </div>
  );
}

/**
 * "This payment vs your usual" (2026-11-22): a flagged payment next to your own usual payments,
 * the recipient and the time, with how unusual the pattern is. Built from the statement only, and
 * labelled as an unusual pattern, not proof of fraud.
 */
export function TxnProfileCard({
  anomaly,
  analysis,
}: {
  anomaly: Pick<Anomaly, 'txnIds' | 'score'>;
  analysis: Pick<StatementAnalysis, 'txns' | 'baseline'>;
}) {
  const { t } = useTranslation();
  const p = profileOf(anomaly, analysis);
  if (!p) return null;
  const big =
    p.times !== null && p.times >= 3 ? 'high' : p.times !== null && p.times >= 1.5 ? 'mid' : 'none';
  const recipient =
    p.paidBefore === 0 && !p.regular
      ? { value: t('profile.firstTime'), level: 'high' as const }
      : p.regular
        ? { value: t('profile.regular'), level: 'none' as const }
        : { value: t('profile.paidBefore', { n: p.paidBefore }), level: 'none' as const };
  const time =
    p.hour === null
      ? { value: '—', note: t('profile.noTime'), level: 'none' as const }
      : {
          value: p.clock ?? '—',
          note:
            p.unusualHour === null
              ? undefined
              : p.unusualHour
                ? t('profile.oddHour')
                : t('profile.usualHour'),
          level: p.unusualHour ? ('high' as const) : ('none' as const),
        };
  return (
    <section aria-labelledby="profile-title" className="mt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 id="profile-title" className="text-sm font-semibold text-text">
          {t('profile.title')}
        </h4>
        <p className="flex items-center gap-2 text-xs text-text-2">
          {t('profile.score', { n: p.score })}
          <span
            className="inline-block h-1.5 w-20 overflow-hidden rounded-full bg-overlay/10"
            aria-hidden
          >
            <span
              className="block h-full rounded-full bg-risk-scam"
              style={{ width: `${p.score}%` }}
            />
          </span>
        </p>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-2">
        <Tile label={t('profile.usual')} value={inr(Math.round(p.typical))} />
        <Tile
          label={p.count > 1 ? t('profile.these', { n: p.count }) : t('profile.thisOne')}
          value={inr(p.amount)}
          note={
            p.times !== null && p.times >= 1.5
              ? t('profile.times', { n: p.times >= 10 ? Math.round(p.times) : p.times })
              : undefined
          }
          level={big}
        />
        <Tile label={t('profile.recipient')} value={recipient.value} level={recipient.level} />
        <Tile label={t('profile.time')} value={time.value} note={time.note} level={time.level} />
      </dl>
      <p className="mt-2 text-xs text-text-2">{t('profile.note')}</p>
    </section>
  );
}
