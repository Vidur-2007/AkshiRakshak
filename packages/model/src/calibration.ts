import type { Calibration } from '@akshi/contracts';

export const DEFAULT_CALIBRATION: Calibration = {
  version: 'default',
  thresholds: { scam: 70, suspicious: 40 },
  fusion: { rules: 0.45, model: 0.35, links: 0.2 },
  aiBlend: 0.2,
};

const inRange = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** Returns a fresh Calibration from calibration.json, or the defaults (whole) if any value is missing or out of range. */
export function parseCalibration(raw: unknown): Calibration {
  const d = DEFAULT_CALIBRATION;
  const fallback = (): Calibration => ({ ...d, thresholds: { ...d.thresholds }, fusion: { ...d.fusion } });
  if (typeof raw !== 'object' || raw === null) return fallback();
  const c = raw as Partial<Calibration>;
  const t = c.thresholds;
  const f = c.fusion;
  if (typeof c.version !== 'string' || !t || !f) return fallback();
  if (!inRange(t.scam, 0, 100) || !inRange(t.suspicious, 0, 100) || t.suspicious >= t.scam) return fallback();
  if (!inRange(f.rules, 0, 1) || !inRange(f.model, 0, 1) || !inRange(f.links, 0, 1)) return fallback();
  if (!inRange(c.aiBlend, 0, 1)) return fallback();
  return {
    version: c.version,
    thresholds: { scam: t.scam, suspicious: t.suspicious },
    fusion: { rules: f.rules, model: f.model, links: f.links },
    aiBlend: c.aiBlend,
  };
}
