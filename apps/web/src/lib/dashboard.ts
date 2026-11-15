/**
 * Dashboard numbers from local history (§5.11). "Money at risk in flagged
 * messages" is the sum of amounts in scans with verdict `scam` (SPEC.md §1.3).
 */
import { dayKey, lastDays } from './charts';
import type { ScanRecord } from './db';
import type { ScamCategory } from './engine';

export interface Kpis {
  scans: number;
  threats: number;
  moneyAtRisk: number;
  linksAndQrs: number;
}

export function computeKpis(scans: ScanRecord[]): Kpis {
  let threats = 0;
  let moneyAtRisk = 0;
  let linksAndQrs = 0;
  for (const s of scans) {
    if (s.verdict !== 'no_signs') threats++;
    if (s.verdict === 'scam')
      moneyAtRisk += s.result.entities.amounts.reduce(
        (sum, a) => sum + (a.value > 0 ? a.value : 0),
        0,
      );
    linksAndQrs += s.result.entities.urls.length + (s.kind === 'qr' ? 1 : 0);
  }
  return { scans: scans.length, threats, moneyAtRisk: Math.round(moneyAtRisk), linksAndQrs };
}

export function byCategory(scans: ScanRecord[]): { category: ScamCategory; count: number }[] {
  const counts = new Map<ScamCategory, number>();
  for (const s of scans)
    if (s.category && s.verdict !== 'no_signs')
      counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
  return [...counts]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

export function byDay(
  scans: ScanRecord[],
  days = 14,
  today = new Date(),
): { day: string; scans: number; threats: number }[] {
  const keys = lastDays(days, today);
  const map = new Map(keys.map((k) => [k, { day: k, scans: 0, threats: 0 }]));
  for (const s of scans) {
    const row = map.get(dayKey(new Date(s.createdAt)));
    if (!row) continue;
    row.scans++;
    if (s.verdict !== 'no_signs') row.threats++;
  }
  return keys.map((k) => map.get(k)!);
}

/** Digits and a leading + only, for tel: links; null if it cannot be a phone number. */
export function telHref(phone: string): string | null {
  const cleaned = phone
    .trim()
    .replace(/[^\d+]/g, '')
    .replace(/(?!^)\+/g, '');
  const digits = cleaned.replace('+', '');
  return digits.length >= 6 && digits.length <= 15 ? `tel:${cleaned}` : null;
}
