import { m } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { scoreLive, signalText, type LiveScore } from '@/lib/engine';
import { spring } from '@/lib/motion';
import { clampScore, VERDICT_COLOR, VERDICT_ICON } from '@/lib/risk';
import { useAppStore } from '@/lib/store';

export const LIVE_INTERVAL_MS = 150;

/** scoreLive at most every 150 ms, on an animation frame (§5.1). */
export function useLiveScore(text: string): LiveScore | null {
  const lang = useAppStore((s) => s.lang);
  const [score, setScore] = useState<LiveScore | null>(null);
  const last = useRef(0);
  useEffect(() => {
    if (!text.trim()) {
      setScore(null);
      return;
    }
    let raf = 0;
    const wait = Math.max(0, LIVE_INTERVAL_MS - (performance.now() - last.current));
    const timer = window.setTimeout(() => {
      raf = requestAnimationFrame(() => {
        last.current = performance.now();
        setScore(scoreLive(text, lang));
      });
    }, wait);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [text, lang]);
  return score;
}

/** Horizontal meter with the number in mono and up to three signal chips (§5.1). */
export function LiveRiskMeter({ live }: { live: LiveScore | null }) {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.lang);
  const score = live ? clampScore(live.riskScore) : 0;
  const Icon = live ? VERDICT_ICON[live.verdict] : null;
  const color = live ? VERDICT_COLOR[live.verdict] : 'transparent';
  return (
    <div aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="text-sm text-text-2">{t('landing.liveRisk')}</span>
        <div
          className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/8"
          role="img"
          aria-label={`${t('landing.liveRisk')}: ${score} ${t('landing.outOf100')}`}
        >
          <m.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ background: color }}
            animate={{ width: `${score}%` }}
            transition={spring.ui}
          />
        </div>
        <span className="w-9 text-right font-mono text-lg font-semibold tabular-nums">
          {live ? score : '–'}
        </span>
      </div>
      {live && Icon && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color }}>
            <Icon className="size-4" aria-hidden />
            {t(`verdict.${live.verdict}`)}
          </span>
          {live.topSignals.slice(0, 3).map((id) => (
            <span
              key={id}
              className="rounded-full border border-glass-border bg-surface-2 px-2.5 py-0.5 text-xs text-text"
            >
              {signalText(id, lang).label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
