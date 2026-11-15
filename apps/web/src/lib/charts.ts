/**
 * Small chart maths for the hand-made SVG charts (statement timeline, dashboard
 * bars and areas). No chart library: see docs/progress/web.md.
 */
export type Scale = (v: number) => number;

export function linear(d0: number, d1: number, r0: number, r1: number): Scale {
  const span = d1 - d0 || 1;
  return (v) => r0 + ((v - d0) / span) * (r1 - r0);
}

/** Log scale for amounts (₹100 and ₹48,000 on one axis); values ≤ 0 clamp to the minimum. */
export function log10Scale(d0: number, d1: number, r0: number, r1: number): Scale {
  const l0 = Math.log10(Math.max(1, d0));
  const l1 = Math.log10(Math.max(d0 + 1, d1));
  const lin = linear(l0, l1, r0, r1);
  return (v) => lin(Math.log10(Math.max(Math.max(1, d0), v)));
}

/** Powers of ten covering [min, max] for a log axis: 100, 1k, 10k, 1L … */
export function logTicks(min: number, max: number): number[] {
  const lo = Math.floor(Math.log10(Math.max(1, min)));
  const hi = Math.ceil(Math.log10(Math.max(10, max)));
  const out: number[] = [];
  for (let e = lo; e <= hi; e++) out.push(10 ** e);
  return out;
}

/** A round upper bound for a linear axis (1, 2, 2.5, 5 × 10^n). */
export function niceMax(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * exp) return m * exp;
  return 10 * exp;
}

/** ₹ amounts in the Indian style, short: ₹950, ₹1.2k, ₹48k, ₹1.5L, ₹2Cr. */
export function inrShort(v: number): string {
  const a = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  const trim = (n: number) =>
    n >= 10 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString();
  if (a >= 1e7) return `${sign}₹${trim(a / 1e7)}Cr`;
  if (a >= 1e5) return `${sign}₹${trim(a / 1e5)}L`;
  if (a >= 1e3) return `${sign}₹${trim(a / 1e3)}k`;
  return `${sign}₹${Math.round(a)}`;
}

export function inr(v: number): string {
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/** Dot radius grows with the square root of the amount, within [min, max]. */
export function dotRadius(amount: number, maxAmount: number, min = 3, max = 11): number {
  if (maxAmount <= 0) return min;
  return min + (max - min) * Math.sqrt(Math.max(0, amount) / maxAmount);
}

/** The last `n` local calendar days, oldest first, as YYYY-MM-DD. */
export function lastDays(n: number, today = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    out.push(dayKey(d));
  }
  return out;
}

export function dayKey(d: Date): string {
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
