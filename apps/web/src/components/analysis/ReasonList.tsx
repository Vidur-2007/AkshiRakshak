import { CircleCheck } from 'lucide-react';
import { m } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { Signal } from '@/lib/engine';
import { TONE_COLOR } from '@/lib/risk';
import { rangeTone } from '@/lib/spans';
import { REVEAL_MS, useRevealTransition } from './reveal';

/** Risky signals by weight, then reassuring (negative-weight) ones last, in green (§5.3). */
export function orderReasons(signals: Signal[]): Signal[] {
  const risky = signals.filter((s) => s.weight >= 0).sort((a, b) => b.weight - a.weight);
  const reassuring = signals.filter((s) => s.weight < 0).sort((a, b) => a.weight - b.weight);
  return [...risky, ...reassuring];
}

export function ReasonList({ signals }: { signals: Signal[] }) {
  const { t } = useTranslation();
  const tr = useRevealTransition();
  const ordered = orderReasons(signals);
  const maxAbs = Math.max(0.0001, ...ordered.map((s) => Math.abs(s.weight)));
  if (!ordered.length) return <p className="text-text-2">{t('analysis.noReasons')}</p>;
  return (
    <ul className="flex flex-col divide-y divide-glass-border">
      {ordered.map((s, i) => {
        const reassuring = s.weight < 0;
        const color =
          s.source === 'ai'
            ? TONE_COLOR.ai
            : TONE_COLOR[rangeTone({ weight: s.weight, signals: [s] })];
        const delay = REVEAL_MS.reasons + i * REVEAL_MS.reasonGap;
        return (
          <m.li
            key={s.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={tr(delay, 0.35)}
            className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
          >
            {reassuring ? (
              <CircleCheck className="mt-0.5 size-4.5 shrink-0 text-risk-safe" aria-hidden />
            ) : (
              <span
                className="mt-1.5 size-2.5 shrink-0 rounded-full"
                style={{ background: color }}
                aria-hidden
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-text">
                {reassuring && <span className="text-risk-safe">{t('analysis.reassuring')}: </span>}
                {s.label}
                {s.source === 'ai' && (
                  <span className="ml-2 rounded-full border border-ai/40 bg-ai/10 px-1.5 py-0.5 align-middle text-[0.7rem] font-semibold text-ai">
                    AI
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-sm text-text-2">{s.detail}</p>
            </div>
            <div
              className="mt-2 h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-white/8 sm:w-24"
              aria-hidden
            >
              <m.div
                className="h-full rounded-full"
                style={{ background: color, originX: 0 }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: Math.abs(s.weight) / maxAbs }}
                transition={tr(delay + 80, 0.5)}
              />
            </div>
          </m.li>
        );
      })}
    </ul>
  );
}
