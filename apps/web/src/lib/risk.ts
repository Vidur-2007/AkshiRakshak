import { CircleAlert, CircleCheck, OctagonX, type LucideIcon } from 'lucide-react';
import type { Verdict } from './engine';

/** Risk colour token per verdict. Use only where the colour means a risk level. */
export const VERDICT_COLOR: Record<Verdict, string> = {
  scam: 'var(--risk-scam)',
  suspicious: 'var(--risk-warn)',
  no_signs: 'var(--risk-safe)',
};

/** Risk is never shown by colour alone (§6): every verdict has an icon too. */
export const VERDICT_ICON: Record<Verdict, LucideIcon> = {
  scam: OctagonX,
  suspicious: CircleAlert,
  no_signs: CircleCheck,
};

export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
