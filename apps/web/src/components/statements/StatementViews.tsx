import { m } from 'motion/react';
import { useMemo, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { SeverityChip } from '@/components/analysis/VerdictHeader';
import { useRevealTransition } from '@/components/analysis/reveal';
import { dotRadius, inr, inrShort, linear, log10Scale, logTicks, niceMax } from '@/lib/charts';
import type { Anomaly, StatementAnalysis, Txn } from '@/lib/engine';
import { TONE_COLOR } from '@/lib/risk';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { TxnProfileCard } from './TxnProfileCard';

export const ANOMALY_TONE: Record<Anomaly['severity'], 'scam' | 'warn'> = {
  high: 'scam',
  medium: 'warn',
  low: 'warn',
};
const SEVERITY_ORDER: Record<Anomaly['severity'], number> = { high: 0, medium: 1, low: 2 };

export function sortAnomalies(a: Anomaly[]): Anomaly[] {
  return [...a].sort(
    (x, y) => SEVERITY_ORDER[x.severity] - SEVERITY_ORDER[y.severity] || y.score - x.score,
  );
}

const W = 640;
const H = 260;
const P = { l: 46, r: 14, t: 14, b: 30 };

/** Chart geometry, separate from rendering so it can be tested. */
export function statementGeometry(txns: Txn[], baseline: StatementAnalysis['baseline']) {
  const debits = txns.filter((t) => t.direction === 'debit' && t.amount > 0);
  const times = debits.map((t) => Date.parse(t.date)).filter(Number.isFinite);
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const amounts = debits.map((t) => t.amount);
  const lo = Math.max(10, Math.min(...amounts, baseline.medianDebit || Infinity) * 0.6);
  const hi = Math.max(...amounts, baseline.p90Debit) * 1.4;
  const ticks = logTicks(lo, hi).filter((v) => v >= lo / 1.01 && v <= hi * 1.01);
  const x = linear(t0, t1 === t0 ? t0 + 1 : t1, P.l, W - P.r);
  const y = log10Scale(lo, hi, H - P.b, P.t);
  const maxAmount = Math.max(1, ...amounts);
  return { debits, x, y, ticks, t0, t1, maxAmount };
}

/**
 * Debits over time as dots sized by amount, the user's normal range (median to p90)
 * shaded, anomalies as coloured dots that pulse a few times (§5.8).
 */
export function StatementChart({
  analysis,
  selected,
  onSelect,
}: {
  analysis: StatementAnalysis;
  selected: string | null;
  onSelect: (anomalyId: string) => void;
}) {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  const tr = useRevealTransition();
  const g = useMemo(() => statementGeometry(analysis.txns, analysis.baseline), [analysis]);
  const byTxn = useMemo(() => {
    const map = new Map<string, Anomaly>();
    for (const a of sortAnomalies(analysis.anomalies))
      for (const id of a.txnIds) if (!map.has(id)) map.set(id, a);
    return map;
  }, [analysis.anomalies]);
  if (g.debits.length === 0) return null;
  const bandTop = g.y(Math.max(analysis.baseline.p90Debit, analysis.baseline.medianDebit));
  const bandBottom = g.y(analysis.baseline.medianDebit);
  const dateFmt = new Intl.DateTimeFormat(lang === 'en' ? 'en-IN' : `${lang}-IN`, {
    day: 'numeric',
    month: 'short',
  });
  const xTicks = Array.from({ length: 5 }, (_, i) => g.t0 + ((g.t1 - g.t0) * i) / 4);
  const onKey = (e: KeyboardEvent<SVGGElement>, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(id);
    }
  };
  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="group"
        aria-label={t('tx.chartLabel')}
      >
        {/* normal band (median → p90): not a risk colour */}
        <rect
          x={P.l}
          y={bandTop}
          width={W - P.l - P.r}
          height={Math.max(2, bandBottom - bandTop)}
          fill="var(--brand)"
          fillOpacity={0.08}
        />
        <line
          x1={P.l}
          x2={W - P.r}
          y1={bandBottom}
          y2={bandBottom}
          stroke="var(--brand)"
          strokeOpacity={0.35}
          strokeDasharray="4 4"
        />
        {g.ticks.map((v) => (
          <g key={v}>
            <line
              x1={P.l}
              x2={W - P.r}
              y1={g.y(v)}
              y2={g.y(v)}
              stroke="var(--text-2)"
              strokeOpacity={0.12}
            />
            <text
              x={P.l - 8}
              y={g.y(v) + 4}
              textAnchor="end"
              fontSize="11"
              fill="var(--text-2)"
              className="font-mono"
            >
              {inrShort(v)}
            </text>
          </g>
        ))}
        {xTicks.map((v, i) => (
          <text
            key={i}
            x={g.x(v)}
            y={H - 8}
            textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}
            fontSize="11"
            fill="var(--text-2)"
          >
            {dateFmt.format(new Date(v))}
          </text>
        ))}
        {g.debits.map((txn, i) => {
          const a = byTxn.get(txn.id);
          const cx = g.x(Date.parse(txn.date));
          const cy = g.y(txn.amount);
          const r = dotRadius(txn.amount, g.maxAmount);
          if (!a) {
            return (
              <m.circle
                key={txn.id}
                cx={cx}
                cy={cy}
                r={r}
                fill="var(--text-2)"
                fillOpacity={0.45}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={tr(Math.min(i, 60) * 12, 0.3)}
              />
            );
          }
          const color = TONE_COLOR[ANOMALY_TONE[a.severity]];
          const isSel = selected === a.id;
          return (
            <g
              key={txn.id}
              role="button"
              tabIndex={0}
              aria-label={a.title}
              aria-pressed={isSel}
              onClick={() => onSelect(a.id)}
              onKeyDown={(e) => onKey(e, a.id)}
              className="cursor-pointer outline-none [&:focus-visible>circle:last-child]:stroke-brand"
            >
              <circle
                cx={cx}
                cy={cy}
                r={r + 2}
                fill="none"
                stroke={color}
                strokeWidth={2}
                className="anomaly-pulse"
              />
              <circle
                cx={cx}
                cy={cy}
                r={r + 2}
                fill={color}
                stroke={isSel ? 'var(--text)' : 'var(--surface)'}
                strokeWidth={isSel ? 3 : 2}
              />
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-[3px] bg-brand/20" aria-hidden />
          {t('tx.band')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-text-2/50" aria-hidden />
          {t('tx.legendPayments')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-risk-scam" aria-hidden />
          {t('tx.anomaliesTitle')}
        </span>
      </figcaption>
    </figure>
  );
}

/** One unusual payment with its "why unusual" feature table (§5.8). */
export function AnomalyCard({
  anomaly,
  txns,
  baseline,
}: {
  anomaly: Anomaly;
  txns: Txn[];
  /** the statement's own baseline, for the "This payment vs your usual" profile */
  baseline?: StatementAnalysis['baseline'];
}) {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  const color = TONE_COLOR[ANOMALY_TONE[anomaly.severity]];
  const related = txns.filter((x) => anomaly.txnIds.includes(x.id));
  const fmt = new Intl.DateTimeFormat(lang === 'en' ? 'en-IN' : `${lang}-IN`, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return (
    <article
      className="rounded-card border-l-4 bg-surface-2 p-4 sm:p-5"
      style={{ borderLeftColor: color }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-base font-semibold">{anomaly.title}</h3>
        <SeverityChip severity={anomaly.severity} />
      </div>
      <p className="mt-2 text-sm text-text">{anomaly.explanation}</p>
      {baseline && <TxnProfileCard anomaly={anomaly} analysis={{ txns, baseline }} />}
      {anomaly.features.length > 0 && (
        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-text-2">
              <th className="pb-1 font-medium">{t('tx.featureCol')}</th>
              <th className="pb-1 font-medium">{t('tx.valueCol')}</th>
              <th className="pb-1 font-medium">{t('tx.baselineCol')}</th>
            </tr>
          </thead>
          <tbody>
            {anomaly.features.map((f) => (
              <tr key={f.name} className="border-t border-glass-border">
                <td className="py-1.5 pr-3 text-text-2">{f.name}</td>
                <td className="py-1.5 pr-3 font-mono font-semibold">{f.value}</td>
                <td className="py-1.5 font-mono text-text-2">{f.baseline}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {related.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-xs text-text-2">
          {related.map((x) => (
            <li key={x.id} className="font-mono">
              {x.hasTime ? fmt.format(new Date(x.date)) : x.date.slice(0, 10)} ·{' '}
              {x.counterparty ?? x.description} · {inr(x.amount)}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/** Spending by category and month (M5.3). Brand shades, not risk colours. */
export function SpendingSummary({ summary }: { summary: StatementAnalysis['summary'] }) {
  const { t } = useTranslation();
  const tr = useRevealTransition();
  const maxCat = Math.max(1, ...summary.byCategory.map((c) => c.amount));
  const maxMonth = niceMax(Math.max(1, ...summary.byMonth.flatMap((mm) => [mm.in, mm.out])));
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div>
        <div className="mb-3 flex gap-6 text-sm">
          <span>
            <span className="block text-xs text-text-2">{t('tx.totalIn')}</span>
            <span className="font-mono font-semibold">{inr(summary.totalIn)}</span>
          </span>
          <span>
            <span className="block text-xs text-text-2">{t('tx.totalOut')}</span>
            <span className="font-mono font-semibold">{inr(summary.totalOut)}</span>
          </span>
        </div>
        <h3 className="mb-2 text-xs font-medium tracking-wide text-text-2 uppercase">
          {t('tx.byCategory')}
        </h3>
        <ul className="flex flex-col gap-2">
          {summary.byCategory.map((c, i) => (
            <li
              key={c.category}
              className="grid grid-cols-[7rem_minmax(0,1fr)_5rem] items-center gap-2 text-sm"
            >
              <span className="truncate">{t(`spend.${c.category}`)}</span>
              <span className="h-2 overflow-hidden rounded-full bg-overlay/6" aria-hidden>
                <m.span
                  className="block h-full rounded-full bg-brand/70"
                  style={{ originX: 0 }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: c.amount / maxCat }}
                  transition={tr(200 + i * 40, 0.5)}
                />
              </span>
              <span className="text-right font-mono text-xs">{inrShort(c.amount)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-2 text-xs font-medium tracking-wide text-text-2 uppercase">
          {t('tx.byMonth')}
        </h3>
        <ul className="flex flex-col gap-3">
          {summary.byMonth.map((mm) => (
            <li key={mm.month} className="text-sm">
              <span className="font-mono text-xs text-text-2">{mm.month}</span>
              {(['in', 'out'] as const).map((k) => (
                <div
                  key={k}
                  className="mt-1 grid grid-cols-[3.5rem_minmax(0,1fr)_5rem] items-center gap-2"
                >
                  <span className="text-xs text-text-2">
                    {k === 'in' ? t('tx.moneyIn') : t('tx.moneyOut')}
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-overlay/6" aria-hidden>
                    <span
                      className={cn(
                        'block h-full rounded-full',
                        k === 'in' ? 'bg-brand/70' : 'bg-text-2/60',
                      )}
                      style={{ width: `${(mm[k] / maxMonth) * 100}%` }}
                    />
                  </span>
                  <span className="text-right font-mono text-xs">{inrShort(mm[k])}</span>
                </div>
              ))}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** "Row 12: …" when the parser reports a row number. */
export function parseErrorRow(message: string): { row: number | null; message: string } {
  const m1 = /^(?:row|line)\s*(\d+)\s*[:-]\s*(.+)$/i.exec(message.trim());
  if (m1) return { row: Number(m1[1]), message: m1[2] ?? '' };
  return { row: null, message };
}
