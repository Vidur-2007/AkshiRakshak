/**
 * RiskGauge geometry (SPEC_B_WEB.md §5.3). A 240° arc opening at the bottom:
 * score 0 sits at the lower left, 100 at the lower right. Angles are in degrees,
 * measured clockwise from 12 o'clock.
 */
export const GAUGE_START = -120;
export const GAUGE_END = 120;
export const GAUGE_SWEEP = GAUGE_END - GAUGE_START;
/** Verdict thresholds drawn as ticks (SPEC.md §7.3 defaults). */
export const GAUGE_TICKS = [40, 70] as const;

export interface Point {
  x: number;
  y: number;
}

export function clampPct(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, score));
}

export function scoreToAngle(score: number): number {
  return GAUGE_START + (clampPct(score) / 100) * GAUGE_SWEEP;
}

export function polar(cx: number, cy: number, r: number, angleDeg: number): Point {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** SVG path for a clockwise arc from `from` to `to` degrees. */
export function arcPath(cx: number, cy: number, r: number, from: number, to: number): string {
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, to);
  const largeArc = Math.abs(to - from) > 180 ? 1 : 0;
  return `M ${round(a.x)} ${round(a.y)} A ${r} ${r} 0 ${largeArc} 1 ${round(b.x)} ${round(b.y)}`;
}

/** Fraction of the full arc covered by `score`, for pathLength animation. */
export function scoreToFraction(score: number): number {
  return clampPct(score) / 100;
}

/** Tick line from the inside to the outside of the arc at a given score. */
export function tickLine(cx: number, cy: number, rInner: number, rOuter: number, score: number) {
  const angle = scoreToAngle(score);
  return { from: polar(cx, cy, rInner, angle), to: polar(cx, cy, rOuter, angle) };
}

/** Circle ring: stroke-dashoffset for a 0–1 fill. */
export function ringOffset(
  radius: number,
  fraction: number,
): { circumference: number; offset: number } {
  const circumference = 2 * Math.PI * radius;
  const f = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  return { circumference, offset: circumference * (1 - f) };
}
