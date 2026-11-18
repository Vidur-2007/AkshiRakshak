/**
 * Dashboard numbers from local history (§5.11). "Money at risk in flagged
 * messages" is the sum of amounts in scans with verdict `scam` (SPEC.md §1.3).
 */
import { dayKey, lastDays } from './charts';
import type { ScanRecord } from './db';
import type { ScamCategory, SignalId } from './engine';

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

// ── Personal tips (M11.6, P2) ──────────────────────────────────────────────────

/** Tip groups, each triggered by signals seen in the user's own flagged checks. */
const TIP_SIGNALS = {
  codes: ['ASKS_OTP', 'ASKS_PIN', 'ASKS_CVV_PASSWORD'],
  receive: ['RECEIVE_WITH_PIN', 'COLLECT_REQUEST', 'QR_TO_RECEIVE'],
  links: [
    'SUSPICIOUS_LINK',
    'LOOKALIKE_DOMAIN',
    'SHORTENED_URL',
    'IP_URL',
    'RISKY_TLD',
    'PUNYCODE',
    'APK_LINK',
  ],
  apps: ['ASKS_REMOTE_APP', 'RISKY_ATTACHMENT'],
  pressure: ['THREAT_BLOCK', 'THREAT_LEGAL', 'STAY_ON_CALL', 'SECRECY'],
  money: ['ADVANCE_FEE', 'TASK_JOB_PAYMENT', 'TOO_GOOD_RETURNS', 'PRIZE_LOTTERY'],
} as const satisfies Record<string, readonly SignalId[]>;

export type TipId = keyof typeof TIP_SIGNALS | 'contact' | 'start';

export interface PersonalTip {
  id: TipId;
  /** how many of the user's flagged checks showed this pattern */
  count: number;
}

/**
 * Up to `max` tips from the user's history: the patterns that showed up most often in
 * their flagged checks, then a trusted-contact nudge. Only counts, never message text.
 */
export function personalTips(
  scans: readonly Pick<ScanRecord, 'verdict' | 'result'>[],
  hasContact: boolean,
  max = 3,
): PersonalTip[] {
  const flagged = scans.filter((s) => s.verdict === 'scam' || s.verdict === 'suspicious');
  const tips: PersonalTip[] = [];
  for (const [id, ids] of Object.entries(TIP_SIGNALS) as [
    keyof typeof TIP_SIGNALS,
    readonly SignalId[],
  ][]) {
    const count = flagged.filter((s) =>
      s.result.signals.some((sig) => sig.weight > 0 && ids.includes(sig.id)),
    ).length;
    if (count > 0) tips.push({ id, count });
  }
  tips.sort((a, b) => b.count - a.count);
  if (!hasContact) tips.push({ id: 'contact', count: 0 });
  if (scans.length === 0) return [{ id: 'start', count: 0 }];
  return tips.slice(0, max);
}
