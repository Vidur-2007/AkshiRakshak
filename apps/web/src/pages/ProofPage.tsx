import { ChevronDown, FlaskConical } from 'lucide-react';
import { m } from 'motion/react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { RevealProvider, useRevealTransition } from '@/components/analysis/reveal';
import { usePageTitle } from '@/hooks/usePageTitle';
import { categoryText, EVAL_REPORT, type EvalReport, type Metrics } from '@/lib/engine';
import { isPlaceholderReport, orderedConfigs, pct, rowShares } from '@/lib/proof';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

function Block({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('surface p-5 sm:p-6', className)}>
      <h2 className="text-sm font-medium tracking-wide text-text-2 uppercase">{title}</h2>
      {hint && <p className="mt-1 text-sm text-text-2">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** A 0–1 value as a bar with its percentage; brand shade (a metric, not a risk level). */
function PctBar({
  label,
  value,
  sub,
  i = 0,
}: {
  label: string;
  value: number;
  sub?: string;
  i?: number;
}) {
  const tr = useRevealTransition();
  return (
    <li className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_3.5rem] items-center gap-3 text-sm">
      <span className="truncate">
        {label}
        {sub && <span className="block text-xs text-text-2">{sub}</span>}
      </span>
      <span className="h-2.5 overflow-hidden rounded-full bg-white/6" aria-hidden>
        <m.span
          className="block h-full rounded-full bg-brand/70"
          style={{ originX: 0 }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: Math.max(0, Math.min(1, value)) }}
          transition={tr(150 + i * 60, 0.6)}
        />
      </span>
      <span className="text-right font-mono tabular-nums">{pct(value)}</span>
    </li>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="surface p-5">
      <p className="font-mono text-[2.5rem] leading-none font-semibold tabular-nums">
        {pct(value, value < 0.1 ? 1 : 0)}
      </p>
      <p className="mt-2 font-medium">{label}</p>
      <p className="mt-1 text-xs text-text-2">{hint}</p>
    </div>
  );
}

function MetricsTable({ rows }: { rows: { label: string; m: Metrics | null }[] }) {
  const { t } = useTranslation();
  const cols: [string, (x: Metrics) => string][] = [
    [t('proof.precision'), (x) => pct(x.precision)],
    [t('proof.recall'), (x) => pct(x.recall)],
    [t('proof.f1'), (x) => pct(x.f1)],
    [t('proof.accuracy'), (x) => pct(x.accuracy)],
    [t('proof.fpr'), (x) => pct(x.fpr, 1)],
    [t('proof.support'), (x) => x.support.toLocaleString('en-IN')],
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead>
          <tr className="text-xs text-text-2">
            <th className="pb-2 font-medium" />
            {cols.map(([c]) => (
              <th key={c} className="pb-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-glass-border">
              <th scope="row" className="py-2.5 pr-3 font-medium">
                {r.label}
              </th>
              {r.m ? (
                cols.map(([c, f]) => (
                  <td key={c} className="py-2.5 font-mono tabular-nums">
                    {f(r.m!)}
                  </td>
                ))
              ) : (
                <td colSpan={cols.length} className="py-2.5 text-text-2">
                  {t('proof.notMeasured')}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Confusion({ c }: { c: EvalReport['confusion'] }) {
  const { t } = useTranslation();
  const shares = rowShares(c.matrix);
  const label = (l: string) =>
    ['scam', 'suspicious', 'no_signs'].includes(l) ? t(`verdict.${l}`) : l;
  return (
    <div className="overflow-x-auto">
      <table className="text-sm">
        <thead>
          <tr>
            <th className="p-2 text-left text-xs font-medium text-text-2">
              {t('proof.actual')} ↓ / {t('proof.predicted')} →
            </th>
            {c.labels.map((l) => (
              <th key={l} scope="col" className="p-2 text-xs font-medium">
                {label(l)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {c.matrix.map((row, i) => (
            <tr key={c.labels[i]}>
              <th scope="row" className="p-2 text-left text-xs font-medium">
                {label(c.labels[i] ?? '')}
              </th>
              {row.map((v, j) => (
                <td key={j} className="p-1">
                  <span
                    className={cn(
                      'grid h-14 min-w-20 place-items-center rounded-chip font-mono tabular-nums',
                      i === j && 'ring-1 ring-brand/50',
                    )}
                    style={{
                      background: `color-mix(in srgb, var(--brand) ${Math.round((shares[i]?.[j] ?? 0) * 60)}%, var(--surface-2))`,
                    }}
                  >
                    {v}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Accordion({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="flex flex-col divide-y divide-glass-border">
      {items.map((it) => (
        <details key={it.q} className="group py-3">
          <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between gap-3 font-medium">
            {it.q}
            <ChevronDown
              className="size-4 shrink-0 text-text-2 transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <p className="mt-2 text-text-2">{it.a}</p>
        </details>
      ))}
    </div>
  );
}

function Proof({ r }: { r: EvalReport }) {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  const placeholder = isPlaceholderReport(r);
  const aiSample = r.configs.find((c) => c.name === 'full_ai_sample');
  return (
    <div className="flex flex-col gap-4">
      {placeholder && (
        <div
          role="note"
          className="flex items-start gap-3 rounded-card border border-risk-warn/50 bg-risk-warn/10 p-4"
        >
          <FlaskConical className="mt-0.5 size-5 shrink-0 text-risk-warn" aria-hidden />
          <div>
            <p className="font-semibold">
              {t('placeholder.sampleData')} · {t('proof.placeholderTitle')}
            </p>
            <p className="mt-1 text-sm">{t('proof.placeholderBody')}</p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label={t('proof.precision')}
          value={r.overall.precision}
          hint={t('proof.precisionHint')}
        />
        <MetricCard
          label={t('proof.recall')}
          value={r.overall.recall}
          hint={t('proof.recallHint')}
        />
        <MetricCard label={t('proof.f1')} value={r.overall.f1} hint={t('proof.f1Hint')} />
        <MetricCard
          label={t('proof.fprBank')}
          value={r.fprGenuineBank}
          hint={t('proof.fprBankHint')}
        />
      </div>

      <Block title={t('proof.vsTitle')}>
        <MetricsTable
          rows={[
            { label: t('proof.synthetic'), m: r.overall },
            { label: t('proof.handwritten'), m: r.handwritten },
          ]}
        />
      </Block>

      <div className="grid gap-4 lg:grid-cols-2">
        <Block
          title={t('proof.ablationTitle')}
          hint={aiSample ? t('proof.aiSampleNote', { n: aiSample.n }) : undefined}
        >
          <ul className="flex flex-col gap-2.5">
            {orderedConfigs(r).map((c, i) => (
              <PctBar
                key={c.name}
                label={t(`proof.cfg.${c.name}`)}
                sub={`F1 · n=${c.n}`}
                value={c.metrics.f1}
                i={i}
              />
            ))}
          </ul>
        </Block>
        <Block title={t('proof.perLangTitle')}>
          <ul className="flex flex-col gap-2.5">
            {r.perLang.map((l, i) => (
              <PctBar
                key={l.lang}
                label={t(`lang.${l.lang}`)}
                sub={`F1 · n=${l.support}`}
                value={l.f1}
                i={i}
              />
            ))}
          </ul>
        </Block>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Block title={t('proof.perCategoryTitle')}>
          <ul className="flex flex-col gap-2.5">
            {r.perCategory.map((c, i) => (
              <PctBar
                key={c.category}
                label={categoryText(c.category, lang).name}
                sub={`n=${c.support}`}
                value={c.recall}
                i={i}
              />
            ))}
          </ul>
        </Block>
        <Block title={t('proof.confusionTitle')} hint={t('proof.confusionHint')}>
          <Confusion c={r.confusion} />
        </Block>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Block title={t('proof.latencyTitle')}>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-text-2">{t('proof.p50')}</dt>
              <dd className="font-mono text-2xl font-semibold">{r.latency.p50Ms} ms</dd>
            </div>
            <div>
              <dt className="text-sm text-text-2">{t('proof.p95')}</dt>
              <dd className="font-mono text-2xl font-semibold">{r.latency.p95Ms} ms</dd>
            </div>
          </dl>
        </Block>
        <Block title={t('proof.statementsTitle')}>
          {r.statements ? (
            <dl className="grid grid-cols-3 gap-4">
              <div>
                <dt className="text-sm text-text-2">{t('proof.injected')}</dt>
                <dd className="font-mono text-2xl font-semibold">{r.statements.injected}</dd>
              </div>
              <div>
                <dt className="text-sm text-text-2">{t('proof.caughtLabel')}</dt>
                <dd className="font-mono text-2xl font-semibold">{r.statements.caught}</dd>
              </div>
              <div>
                <dt className="text-sm text-text-2">{t('proof.falseFlags')}</dt>
                <dd className="font-mono text-2xl font-semibold">
                  {r.statements.falseFlagsPer100}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-text-2">{t('proof.notMeasured')}</p>
          )}
        </Block>
      </div>

      <Block title={t('proof.methodologyTitle')}>
        <Accordion
          items={[
            { q: t('proof.mDataset'), a: t('proof.mDatasetBody') },
            { q: t('proof.mSplits'), a: t('proof.mSplitsBody') },
            { q: t('proof.mHand'), a: t('proof.mHandBody') },
            { q: t('proof.mSynthetic'), a: t('proof.mSyntheticBody') },
            { q: t('proof.mLimits'), a: t('proof.mLimitsBody') },
          ]}
        />
      </Block>

      <Block title={t('proof.datasetsTitle')}>
        <ul className="flex flex-col gap-2 text-sm">
          {r.datasets.map((d) => (
            <li
              key={d.name}
              className="flex flex-wrap justify-between gap-2 border-b border-glass-border pb-2"
            >
              <span>
                <span className="font-mono">{d.name}</span>
                <span className="block text-text-2">{d.description}</span>
              </span>
              <span className="font-mono tabular-nums">{d.size.toLocaleString('en-IN')}</span>
            </li>
          ))}
        </ul>
        {r.notes.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium">{t('proof.notes')}</h3>
            <ul className="mt-1 list-disc pl-5 text-sm text-text-2">
              {r.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-4 font-mono text-xs text-text-2">
          {t('proof.generated', {
            date: r.generatedAt.slice(0, 10),
            engine: r.engineVersion,
            model: r.modelVersion,
          })}
        </p>
      </Block>
    </div>
  );
}

/** Proof (§5.13, M11.4): the measured numbers, exactly as the eval harness wrote them. */
export default function ProofPage() {
  const { t } = useTranslation();
  usePageTitle(t('page.proof.title'));
  return (
    <section
      aria-labelledby="page-title"
      className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 lg:pt-12"
    >
      <h1 id="page-title" className="text-xl font-semibold tracking-tight sm:text-2xl">
        {t('page.proof.title')}
      </h1>
      <p className="mt-2 max-w-2xl text-text-2">{t('page.proof.body')}</p>
      <div className="mt-6">
        <RevealProvider>
          <Proof r={EVAL_REPORT} />
        </RevealProvider>
      </div>
    </section>
  );
}
