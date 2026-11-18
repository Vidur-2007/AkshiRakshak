/**
 * Reveal choreography for the Analysis screen (SPEC_B_WEB.md §5.3).
 *
 *   0 ms     input card becomes the message panel (shared layoutId)
 *   150 ms   gauge arc springs to riskScore, number counts up
 *   400 ms   verdict label, severity and category chips, background glow
 *   600 ms   underlines draw under red-flag spans, strongest first, 80 ms apart
 *   900 ms   reason rows slide in, weight bars fill
 *   1100 ms  action dock rises; on scam one vibration and the STOP icon pulses once
 *
 * Reduced motion (or Elder mode): everything appears at once, numbers without counting.
 */
import { useReducedMotionConfig } from 'motion/react';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAppStore } from '@/lib/store';

export const REVEAL_MS = {
  gauge: 150,
  verdict: 400,
  underline: 600,
  underlineGap: 80,
  reasons: 900,
  reasonGap: 60,
  dock: 1100,
} as const;

export interface Reveal {
  /** no choreography: show the final state immediately */
  instant: boolean;
  /** delay in seconds for Motion, 0 when instant */
  delay(ms: number): number;
}

const RevealContext = createContext<Reveal>({ instant: true, delay: () => 0 });

export function RevealProvider({ children }: { children: ReactNode }) {
  // honours <MotionConfig reducedMotion> ("user" = the OS setting)
  const reduced = useReducedMotionConfig() ?? false;
  const elder = useAppStore((s) => s.elderMode);
  const instant = reduced || elder;
  const value: Reveal = { instant, delay: (ms) => (instant ? 0 : ms / 1000) };
  return <RevealContext.Provider value={value}>{children}</RevealContext.Provider>;
}

export function useReveal(): Reveal {
  return useContext(RevealContext);
}

/** Transition helper: `duration` seconds after `ms` delay; zero-length when instant. */
export function useRevealTransition() {
  const r = useReveal();
  return (ms: number, duration = 0.45) =>
    r.instant ? { duration: 0 } : { delay: ms / 1000, duration, ease: [0.22, 1, 0.36, 1] as const };
}

const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;

/** Counts from 0 to `target` after `delayMs`; returns the target at once when instant. */
export function useCountUp(target: number, delayMs: number, durationMs = 900): number {
  const { instant } = useReveal();
  const [value, setValue] = useState(instant ? target : 0);
  useEffect(() => {
    if (instant) {
      setValue(target);
      return;
    }
    let raf = 0;
    let start = 0;
    const timer = window.setTimeout(() => {
      const tick = (now: number) => {
        if (!start) start = now;
        const p = Math.min(1, (now - start) / durationMs);
        setValue(Math.round(target * easeOutCubic(p)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [target, delayMs, durationMs, instant]);
  return value;
}

/** true once `ms` has passed (immediately when instant). */
export function useAfter(ms: number): boolean {
  const { instant } = useReveal();
  const [done, setDone] = useState(instant);
  useEffect(() => {
    if (instant) {
      setDone(true);
      return;
    }
    const id = window.setTimeout(() => setDone(true), ms);
    return () => window.clearTimeout(id);
  }, [ms, instant]);
  return done;
}
