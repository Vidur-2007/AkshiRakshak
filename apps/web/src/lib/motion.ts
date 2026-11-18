/**
 * Motion tokens and shared variants (SPEC_B_WEB.md §3.3).
 * Durations are in seconds, the unit Motion for React expects.
 * Rule: one attention-grabbing animation on screen at a time; prefer transform and opacity.
 */
import type { Transition, Variants } from 'motion/react';

export const duration = {
  fast: 0.15, // hover, press
  base: 0.25, // most state changes
  slow: 0.45, // panels, sheets
  page: 0.5, // route changes
} as const;

/** Milliseconds, for timers and count-ups that Motion does not drive. */
export const durationMs = {
  fast: 150,
  base: 250,
  slow: 450,
  page: 500,
} as const;

export const ease = [0.22, 1, 0.36, 1] as const;

export const spring = {
  gauge: { type: 'spring', stiffness: 120, damping: 20 },
  ui: { type: 'spring', stiffness: 400, damping: 30 },
} as const satisfies Record<string, Transition>;

export const transition = {
  fast: { duration: duration.fast, ease },
  base: { duration: duration.base, ease },
  slow: { duration: duration.slow, ease },
  page: { duration: duration.page, ease },
} as const satisfies Record<string, Transition>;

/** Route change: outgoing fades and moves up 8px; incoming fades in (§4.1). */
export const pageVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, y: 0, transition: transition.page },
  exit: { opacity: 0, y: -8, transition: { duration: duration.base, ease } },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: transition.base },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: transition.base },
};

/** Bottom sheet / slide-over panel. */
export const sheetVariants: Variants = {
  hidden: { y: '100%' },
  show: { y: 0, transition: { duration: duration.slow, ease } },
  exit: { y: '100%', transition: { duration: duration.base, ease } },
};

/** Children appear one after another, `gap` seconds apart. */
export function stagger(gap = 0.08, delayChildren = 0): Variants {
  return { hidden: {}, show: { transition: { staggerChildren: gap, delayChildren } } };
}

export const pressable = {
  whileTap: { scale: 0.97 },
  transition: spring.ui,
} as const;

/**
 * Convention: use `m.div` (from 'motion/react') inside the app's <LazyMotion strict>,
 * never `motion.div`, so the full Motion bundle stays out of the first load.
 */
export const loadMotionFeatures = () => import('./motionFeatures').then((mod) => mod.default);
