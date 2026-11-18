import { ArrowRight, Play } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { lazy, Suspense, useEffect, useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { LiveRiskMeter, useLiveScore } from '@/components/landing/LiveRiskMeter';
import { ShieldPoster } from '@/components/landing/ShieldPoster';
import { Story } from '@/components/landing/Story';
import { useScan } from '@/components/scan/useScan';
import { buttonVariants } from '@/components/ui/button';
import { usePageTitle } from '@/hooks/usePageTitle';
import { TIER_SETTINGS } from '@/lib/deviceTier';
import type { Verdict } from '@/lib/engine';
import { MAX_INPUT } from '@/lib/scan';
import { useAppStore } from '@/lib/store';

// The canvas core loads after the poster has painted (LCP first, §7).
const ShieldCore = lazy(() => import('@/components/landing/ShieldCore'));

/** Smooth scrolling on the landing page only, high and mid tier only (§3.4). */
function useLenis() {
  const tier = useAppStore((s) => s.deviceTier);
  const elder = useAppStore((s) => s.elderMode);
  const reduced = useReducedMotion() ?? false;
  const enabled = TIER_SETTINGS[tier].lenis && !reduced && !elder;
  useEffect(() => {
    if (!enabled) return;
    let destroyed = false;
    let instance: { destroy(): void } | null = null;
    void import('lenis')
      .then(({ default: Lenis }) => {
        if (!destroyed) instance = new Lenis({ autoRaf: true, lerp: 0.12 });
      })
      .catch(() => undefined);
    return () => {
      destroyed = true;
      instance?.destroy();
    };
  }, [enabled]);
}

export default function LandingPage() {
  const { t } = useTranslation();
  usePageTitle('');
  useLenis();
  const navigate = useNavigate();
  const inputId = useId();
  const [text, setText] = useState('');
  const [settle, setSettle] = useState<Verdict | null>(null);
  const [coreReady, setCoreReady] = useState(false);
  const live = useLiveScore(text);
  const { run, busy } = useScan();

  // Mount the canvas core once the browser is idle after first paint
  useEffect(() => {
    const idle =
      'requestIdleCallback' in window
        ? window.requestIdleCallback
        : (cb: () => void) => window.setTimeout(cb, 300);
    const id = idle(() => setCoreReady(true));
    return () => {
      if ('cancelIdleCallback' in window && typeof id === 'number') window.cancelIdleCallback(id);
    };
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      navigate('/scan');
      return;
    }
    if (live) setSettle(live.verdict);
    // the real scan; the card morphs into the analysis panel (shared layoutId)
    void run(text);
  };

  return (
    <>
      <section
        aria-labelledby="hero-title"
        className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-8 px-4 pt-8 pb-16 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:pt-16"
      >
        <div className="order-2 lg:order-1">
          <h1
            id="hero-title"

            className="enter-rise text-hero font-semibold tracking-tight text-balance"
          >
            {t('app.tagline')}
          </h1>
          <p className="enter-rise mt-5 max-w-xl text-lg text-text-2">{t('app.subhead')}</p>

          <form onSubmit={submit} className="enter-rise">
            <m.div layoutId="scan-card" className="glass mt-8 rounded-sheet p-4">
              <label htmlFor={inputId} className="text-sm font-medium text-text">
                {t('landing.inputLabel')}
              </label>
              <textarea
                id={inputId}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX_INPUT))}
                rows={3}
                placeholder={t('landing.inputPlaceholder')}
                className="mt-2 w-full resize-none rounded-card border border-glass-border bg-surface-2 p-3 text-base text-text outline-none placeholder:text-text-2/70 focus-visible:border-brand"
              />
              <div className="mt-3">
                <LiveRiskMeter live={live} />
              </div>
            </m.div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="submit" disabled={busy} className={buttonVariants({ size: 'lg' })}>
                {t('placeholder.scanNow')}
                <ArrowRight aria-hidden />
              </button>
              <Link to="/tour?start=1" className={buttonVariants({ size: 'lg', variant: 'outline' })}>
                <Play aria-hidden />
                {t('landing.tour')}
              </Link>
            </div>
          </form>
        </div>

        <div className="enter-rise order-1 flex justify-center lg:order-2">
          <div className="relative aspect-square w-[min(72vw,22rem)] lg:w-[min(36vw,30rem)]">
            {coreReady ? (
              <Suspense fallback={<ShieldPoster className="absolute inset-0" settle={settle} />}>
                <ShieldCore
                  className="absolute inset-0"
                  score={live?.riskScore ?? null}
                  charCount={text.length}
                  settle={settle}
                />
              </Suspense>
            ) : (
              <ShieldPoster className="absolute inset-0" settle={settle} />
            )}
          </div>
        </div>
      </section>

      <Story />
    </>
  );
}
