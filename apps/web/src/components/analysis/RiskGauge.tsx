import { m } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { Verdict } from '@/lib/engine';
import {
  arcPath,
  GAUGE_END,
  GAUGE_START,
  GAUGE_TICKS,
  scoreToFraction,
  tickLine,
} from '@/lib/gauge';
import { spring } from '@/lib/motion';
import { clampScore, VERDICT_COLOR } from '@/lib/risk';
import { REVEAL_MS, useCountUp, useReveal } from './reveal';

const SIZE = 200;
const C = SIZE / 2;
const R = 82;
const STROKE = 12;
const TRACK = arcPath(C, C, R, GAUGE_START, GAUGE_END);

/** SVG arc 0–100 with ticks at the 40 and 70 thresholds (§5.3). */
export function RiskGauge({
  score,
  verdict,
  size = SIZE,
}: {
  score: number;
  verdict: Verdict;
  size?: number;
}) {
  const { t } = useTranslation();
  const reveal = useReveal();
  const value = clampScore(score);
  const shown = useCountUp(value, REVEAL_MS.gauge);
  const color = VERDICT_COLOR[verdict];
  return (
    <div
      role="img"
      aria-label={t('analysis.riskLabel', { score: value })}
      className="relative shrink-0"
      style={{ width: size, height: size * 0.86 }}
    >
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE * 0.86}`}
        className="absolute inset-0 size-full overflow-visible"
        aria-hidden
      >
        <path
          d={TRACK}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        {value > 0 && (
          <m.path
            d={TRACK}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            // glow is reserved for the verdict (§3)
            style={{
              filter: `drop-shadow(0 0 12px color-mix(in srgb, ${color} 35%, transparent))`,
            }}
            initial={{ pathLength: reveal.instant ? scoreToFraction(value) : 0 }}
            animate={{ pathLength: scoreToFraction(value) }}
            transition={
              reveal.instant
                ? { duration: 0 }
                : { ...spring.gauge, delay: reveal.delay(REVEAL_MS.gauge) }
            }
          />
        )}
        {GAUGE_TICKS.map((tick) => {
          const { from, to } = tickLine(C, C, R - STROKE / 2 - 5, R + STROKE / 2 + 5, tick);
          return (
            <g key={tick}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="var(--bg)"
                strokeWidth={3}
              />
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="var(--text-2)"
                strokeOpacity={0.7}
                strokeWidth={1.5}
              />
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-x-0 top-[34%] flex flex-col items-center">
        <span className="font-mono text-[3.25rem] leading-none font-semibold tracking-tight tabular-nums">
          {shown}
        </span>
        <span className="mt-1 text-xs text-text-2">{t('analysis.outOf')}</span>
      </div>
    </div>
  );
}
