/**
 * Calibration (SPEC.md §7.3): thresholds, fusion weights and the AI blend come from C's
 * loadCalibration(). The values cross a package boundary, so they are checked here — by hand,
 * not with zod, to keep zod out of the offline core. Anything out of range falls back to the
 * spec defaults as a whole (mixing C's weights with default thresholds would be untested).
 */
import type { Calibration } from '@akshi/contracts';
import { loadCalibration } from '@akshi/model';

export const DEFAULT_CALIBRATION: Calibration = Object.freeze({
  version: 'default',
  thresholds: Object.freeze({ scam: 70, suspicious: 40 }),
  fusion: Object.freeze({ rules: 0.45, model: 0.35, links: 0.2 }),
  aiBlend: 0.2,
}) as Calibration;

const unit = (x: unknown): x is number => typeof x === 'number' && x >= 0 && x <= 1;
const score = (x: unknown): x is number => typeof x === 'number' && x > 0 && x < 100;

/** True when the values make sense: 0 < suspicious < scam < 100, weights in [0, 1] with rules > 0. */
export function isValidCalibration(c: unknown): c is Calibration {
  if (!c || typeof c !== 'object') return false;
  const { thresholds: t, fusion: f, aiBlend, version } = c as Partial<Calibration>;
  return (
    typeof version === 'string' &&
    !!t &&
    score(t.scam) &&
    score(t.suspicious) &&
    t.suspicious < t.scam &&
    !!f &&
    unit(f.rules) &&
    unit(f.model) &&
    unit(f.links) &&
    f.rules > 0 &&
    unit(aiBlend)
  );
}

let warned = false;

/** C's calibration when valid, otherwise the defaults. Called once per analyze(). */
export function currentCalibration(): Calibration {
  let c: unknown;
  try {
    c = loadCalibration();
  } catch {
    c = null;
  }
  if (isValidCalibration(c)) return c;
  if (!warned) {
    warned = true;
    console.warn('[akshi] calibration is invalid; using defaults');
  }
  return DEFAULT_CALIBRATION;
}
