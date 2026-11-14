import { ArrowRight, Play } from 'lucide-react';
import { m } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { LogoMark } from '@/components/shell/Logo';
import { buttonVariants } from '@/components/ui/button';
import { usePageTitle } from '@/hooks/usePageTitle';
import { scoreLive, type LiveScore } from '@/lib/engine';
import { fadeUp, spring, stagger } from '@/lib/motion';
import { clampScore, VERDICT_COLOR, VERDICT_ICON } from '@/lib/risk';
import { useAppStore } from '@/lib/store';

const LIVE_INTERVAL_MS = 150;

/** scoreLive at most every 150 ms (§5.1). The full LiveRiskMeter and ShieldCore arrive in P4. */
function useLiveScore(text: string): LiveScore | null {
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

export default function LandingPage() {
  const { t } = useTranslation();
  usePageTitle('');
  const inputId = useId();
  const [text, setText] = useState('');
  const live = useLiveScore(text);
  const score = live ? clampScore(live.riskScore) : 0;
  const Icon = live ? VERDICT_ICON[live.verdict] : null;

  return (
    <m.section
      variants={stagger(0.08)}
      initial="hidden"
      animate="show"
      className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pt-10 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:pt-20"
    >
      <div className="order-2 lg:order-1">
        <m.h1
          variants={fadeUp}
          className="text-[clamp(2.5rem,8vw,6rem)] leading-[1.02] font-semibold tracking-tight text-balance"
        >
          {t('app.tagline')}
        </m.h1>
        <m.p variants={fadeUp} className="mt-5 max-w-xl text-lg text-text-2">
          {t('app.subhead')}
        </m.p>

        <m.div variants={fadeUp} className="glass mt-8 rounded-card p-4">
          <label htmlFor={inputId} className="text-sm font-medium text-text">
            {t('landing.inputLabel')}
          </label>
          <textarea
            id={inputId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder={t('landing.inputPlaceholder')}
            className="mt-2 w-full resize-none rounded-chip border border-glass-border bg-surface-2 p-3 text-base text-text outline-none placeholder:text-text-2/70 focus-visible:border-brand"
          />
          <div className="mt-3 flex items-center gap-3" aria-live="polite">
            <span className="text-sm text-text-2">{t('landing.liveRisk')}</span>
            <div
              className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/8"
              role="img"
              aria-label={`${t('landing.liveRisk')}: ${score} ${t('landing.outOf100')}`}
            >
              <m.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ background: live ? VERDICT_COLOR[live.verdict] : 'transparent' }}
                animate={{ width: `${score}%` }}
                transition={spring.ui}
              />
            </div>
            <span className="w-8 text-right font-mono text-lg font-semibold tabular-nums">
              {live ? score : '–'}
            </span>
          </div>
          {live && Icon && (
            <p
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium"
              style={{ color: VERDICT_COLOR[live.verdict] }}
            >
              <Icon className="size-4" aria-hidden />
              {t(`verdict.${live.verdict}`)}
            </p>
          )}
        </m.div>

        <m.div variants={fadeUp} className="mt-6 flex flex-wrap gap-3">
          <Link to="/scan" className={buttonVariants({ size: 'lg' })}>
            {t('placeholder.scanNow')}
            <ArrowRight aria-hidden />
          </Link>
          <Link to="/tour" className={buttonVariants({ size: 'lg', variant: 'outline' })}>
            <Play aria-hidden />
            {t('landing.tour')}
          </Link>
        </m.div>
      </div>

      {/* ShieldCore poster stand-in until the 3D core lands in P4 */}
      <m.div variants={fadeUp} className="order-1 flex justify-center lg:order-2" aria-hidden>
        <div className="relative grid size-44 place-items-center sm:size-64 lg:size-80">
          <div className="absolute inset-0 rounded-full bg-brand/10 blur-3xl" />
          <div className="absolute inset-6 rounded-full border border-brand/20" />
          <div className="absolute inset-14 rounded-full border border-brand/10" />
          <LogoMark className="relative size-24 drop-shadow-[0_0_24px_rgb(61_224_255/0.35)] sm:size-32" />
        </div>
      </m.div>
    </m.section>
  );
}
