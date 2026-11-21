/**
 * Judge tour overlay (SPEC_B_WEB.md §5.17): opens each step's route, rings the
 * element marked `data-tour`, and shows a caption with progress, Pause, Skip and
 * Next. The page underneath stays usable; Escape ends the tour. Loaded lazily by
 * the app shell only while a tour runs.
 */
import { Pause, Play, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { loadEngine } from '@/lib/engineLoader';
import {
  applyStepMode,
  captionAtTop,
  STEP_MS,
  TARGET_WAIT_MS,
  TOUR_SAMPLE_ID,
  TOUR_STEPS,
  useTour,
} from '@/lib/tour';
import { cn } from '@/lib/utils';

type Box = { top: number; left: number; width: number; height: number; bottom: number };

const sameBox = (a: Box | null, b: Box) =>
  !!a &&
  Math.abs(a.top - b.top) < 0.5 &&
  Math.abs(a.left - b.left) < 0.5 &&
  Math.abs(a.width - b.width) < 0.5 &&
  Math.abs(a.height - b.height) < 0.5;

const TICK_MS = 100;

export default function TourOverlay() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const index = useTour((s) => s.index);
  const next = useTour((s) => s.next);
  const end = useTour((s) => s.end);
  const step = TOUR_STEPS[index] ?? TOUR_STEPS[0]!;
  const last = index === TOUR_STEPS.length - 1;
  const titleId = useId();

  const [box, setBox] = useState<Box | null>(null);
  const [ready, setReady] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);

  // Open the step's route with the bundled sample
  useEffect(() => {
    let cancelled = false;
    applyStepMode(step);
    void loadEngine().then((engine) => {
      if (cancelled) return;
      const kyc = engine.SAMPLE_MESSAGES.find((s) => s.id === TOUR_SAMPLE_ID)?.text ?? '';
      const { path, state } = step.to(kyc);
      void navigate(path, { state });
    });
    return () => {
      cancelled = true;
    };
  }, [step, navigate]);

  // Follow the target while it animates in and the page scrolls
  useEffect(() => {
    setBox(null);
    setReady(false);
    setElapsed(0);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const t0 = performance.now();
    let scrolled = false;
    let raf = 0;
    const tick = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (el) {
        if (!scrolled) {
          el.scrollIntoView?.({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
          scrolled = true;
        }
        const r = el.getBoundingClientRect();
        const b = { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom };
        setBox((prev) => (sameBox(prev, b) ? prev : b));
        setReady(true);
      } else {
        setBox(null);
        if (performance.now() - t0 > TARGET_WAIT_MS) setReady(true);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  // Step timer: runs once the target is on screen, stops while paused
  useEffect(() => {
    if (!ready || paused) return;
    const id = window.setInterval(() => setElapsed((e) => e + TICK_MS), TICK_MS);
    return () => window.clearInterval(id);
  }, [ready, paused]);
  useEffect(() => {
    if (elapsed >= STEP_MS) next();
  }, [elapsed, next]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') end();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [end]);

  const atTop = captionAtTop(box, typeof window === 'undefined' ? 800 : window.innerHeight);
  const pad = 8;

  return createPortal(
    <>
      {box && (
        <div
          aria-hidden
          data-testid="tour-ring"
          className="pointer-events-none fixed z-[55] rounded-[18px] border-2 border-brand transition-[top,left,width,height] duration-300"
          style={{
            top: box.top - pad,
            left: box.left - pad,
            width: box.width + pad * 2,
            height: box.height + pad * 2,
            boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.55), 0 0 28px 2px rgb(61 224 255 / 0.45)',
          }}
        />
      )}
      <section
        aria-labelledby={titleId}
        data-testid="tour-caption"
        className={cn(
          'fixed inset-x-3 z-[56] mx-auto max-w-md rounded-sheet border border-glass-border bg-surface-2 p-4 shadow-2xl shadow-black/40',
          atTop
            ? 'top-[calc(var(--topbar-h)+12px)]'
            : 'bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+12px)] lg:bottom-6',
        )}
      >
        <div
          role="progressbar"
          aria-label={t('tour.label')}
          aria-valuemin={1}
          aria-valuemax={TOUR_STEPS.length}
          aria-valuenow={index + 1}
          aria-valuetext={t('tour.stepOf', { n: index + 1, total: TOUR_STEPS.length })}
          className="flex gap-1"
        >
          {TOUR_STEPS.map((s, i) => (
            <span key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-overlay/10">
              <span
                className="block h-full rounded-full bg-brand"
                style={{
                  width:
                    i < index
                      ? '100%'
                      : i === index
                        ? `${Math.min(100, (elapsed / STEP_MS) * 100)}%`
                        : '0%',
                }}
              />
            </span>
          ))}
        </div>
        <div aria-live="polite" className="mt-3">
          <p className="text-xs text-text-2">
            {t('tour.stepOf', { n: index + 1, total: TOUR_STEPS.length })}
          </p>
          <h2 id={titleId} className="mt-1 text-base font-semibold">
            {t(`tour.steps.${step.id}.title`)}
          </h2>
          <p className="mt-1 text-sm text-text-2">{t(`tour.steps.${step.id}.body`)}</p>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-pressed={paused}
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
              {paused ? t('tour.resume') : t('tour.pause')}
            </button>
            <button
              type="button"
              onClick={end}
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              <X aria-hidden />
              {t('tour.skip')}
            </button>
          </div>
          <button type="button" onClick={next} className={buttonVariants({ size: 'sm' })}>
            {last ? t('tour.finish') : t('tour.next')}
          </button>
        </div>
      </section>
    </>,
    document.body,
  );
}
