import { m } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { categoryText, type AnalysisResult } from '@/lib/engine';
import { ringOffset } from '@/lib/gauge';
import { CATEGORY_ICON, SEVERITY_TONE, TONE_COLOR, VERDICT_COLOR, VERDICT_ICON } from '@/lib/risk';
import { useAppStore } from '@/lib/store';
import { REVEAL_MS, useReveal, useRevealTransition } from './reveal';
import { RiskGauge } from './RiskGauge';

export function SeverityChip({ severity }: { severity: AnalysisResult['severity'] }) {
  const { t } = useTranslation();
  const color = TONE_COLOR[SEVERITY_TONE[severity]];
  return (
    <span
      className="inline-flex h-8 items-center gap-2 rounded-full border px-3 text-sm font-medium"
      style={{
        borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
    >
      <span className="size-2 rounded-full" style={{ background: color }} aria-hidden />
      {t(`severity.${severity}`)}
    </span>
  );
}

export function CategoryChip({ category }: { category: NonNullable<AnalysisResult['category']> }) {
  const lang = useAppStore((s) => s.lang);
  const Icon = CATEGORY_ICON[category];
  return (
    <span className="inline-flex h-8 items-center gap-2 rounded-full border border-glass-border bg-surface-2 px-3 text-sm text-text">
      <Icon className="size-4 text-text-2" aria-hidden />
      {categoryText(category, lang).name}
    </span>
  );
}

export function ConfidenceRing({ value }: { value: number }) {
  const { t } = useTranslation();
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const { circumference, offset } = ringOffset(14, pct / 100);
  return (
    <span
      className="inline-flex items-center gap-2 text-sm text-text-2"
      role="img"
      aria-label={t('analysis.confidenceLabel', { pct })}
    >
      <svg viewBox="0 0 36 36" className="size-8 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
        <circle
          cx="18"
          cy="18"
          r="14"
          fill="none"
          stroke="var(--brand)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span aria-hidden>
        {t('analysis.confidence')} <span className="font-mono text-text">{pct}%</span>
      </span>
    </span>
  );
}

/** Gauge, verdict word, severity, confidence and category, then the explanation (§5.3). */
export function VerdictHeader({ result }: { result: AnalysisResult }) {
  const { t } = useTranslation();
  const reveal = useReveal();
  const tr = useRevealTransition();
  const Icon = VERDICT_ICON[result.verdict];
  const color = VERDICT_COLOR[result.verdict];
  const pulse = result.verdict === 'scam' && !reveal.instant;
  return (
    <header className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:gap-7 sm:text-left">
      <RiskGauge score={result.riskScore} verdict={result.verdict} />
      <div className="min-w-0 flex-1">
        <m.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={tr(REVEAL_MS.verdict, 0.35)}
          className="inline-flex items-center gap-2.5 text-2xl leading-tight font-semibold tracking-tight"
          style={{ color }}
        >
          <m.span
            className="inline-flex"
            animate={pulse ? { scale: [1, 1.25, 1] } : undefined}
            transition={pulse ? { delay: REVEAL_MS.dock / 1000, duration: 0.5 } : undefined}
          >
            <Icon className="size-8" strokeWidth={2.25} aria-hidden />
          </m.span>
          {t(`verdict.${result.verdict}`)}
        </m.p>
        <m.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={tr(REVEAL_MS.verdict + 60, 0.35)}
          className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start"
        >
          <SeverityChip severity={result.severity} />
          {result.category && <CategoryChip category={result.category} />}
          <ConfidenceRing value={result.confidence} />
        </m.div>
        <m.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={tr(REVEAL_MS.verdict + 120, 0.45)}
          className="mt-4 max-w-prose text-base text-text"
        >
          {result.explanation}
        </m.p>
      </div>
    </header>
  );
}
