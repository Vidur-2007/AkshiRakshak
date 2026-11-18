import { m } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useCountUp, useReveal } from '@/components/analysis/reveal';
import { ringOffset } from '@/lib/gauge';
import { spring } from '@/lib/motion';

const R = 52;

/** Dojo ending score ring (M11.1). Brand colour: a score is not a risk level. */
export function ScoreRing({ share, score, max }: { share: number; score: number; max: number }) {
  const { t } = useTranslation();
  const { instant } = useReveal();
  const pct = Math.round(share * 100);
  const shown = useCountUp(score, 200, 900);
  const { circumference, offset } = ringOffset(R, share);
  return (
    <div
      className="relative grid size-40 place-items-center"
      role="img"
      aria-label={t('dojo.scoreLabel', { pct })}
    >
      <svg viewBox="0 0 120 120" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="10"
        />
        <m.circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: instant ? offset : circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={instant ? { duration: 0 } : { ...spring.gauge, delay: 0.2 }}
        />
      </svg>
      <div className="text-center" aria-hidden>
        <span className="block font-mono text-4xl font-semibold tabular-nums">{shown}</span>
        <span className="text-xs text-text-2">/ {max}</span>
      </div>
    </div>
  );
}
