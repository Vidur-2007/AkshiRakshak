/**
 * analyze() and scoreLive() read thresholds, fusion weights and the AI blend from C's
 * loadCalibration() (SPEC.md §7.3), and fall back to the defaults when the values are invalid.
 */
import type { Calibration } from '@akshi/contracts';
import type * as ModelModule from '@akshi/model';
import { afterEach, describe, expect, it, vi } from 'vitest';

const loadCalibration = vi.fn<() => Calibration>();
vi.mock('@akshi/model', async (orig) => {
  const real = await orig<typeof ModelModule>();
  loadCalibration.mockImplementation(real.loadCalibration);
  return { ...real, loadCalibration: () => loadCalibration() };
});

const { analyze, scoreLive } = await import('../src/index');
const { DEFAULT_CALIBRATION, isValidCalibration, currentCalibration } =
  await import('../src/pipeline/calibration');
const { severityOf } = await import('../src/pipeline/fusion');

const OFF = { expandLinks: false, domainAge: false, layers: { indicators: false } } as const;
const cal = (over: Partial<Calibration>): Calibration => ({
  ...DEFAULT_CALIBRATION,
  version: 'test',
  ...over,
});

// a message whose rules score lands between 40 and 70 with the defaults
const MID = 'Your electricity will be disconnected tonight. Call our officer immediately.';

afterEach(() => {
  loadCalibration.mockReset();
  loadCalibration.mockImplementation(() => ({ ...DEFAULT_CALIBRATION }));
});

describe('calibration', () => {
  it('moves the verdict with C’s thresholds', async () => {
    loadCalibration.mockReturnValue({ ...DEFAULT_CALIBRATION });
    const base = await analyze({ kind: 'message', text: MID, lang: 'en', options: OFF });
    expect(base.riskScore).toBeGreaterThan(0);

    loadCalibration.mockReturnValue(
      cal({ thresholds: { scam: Math.max(2, base.riskScore), suspicious: 1 } }),
    );
    const lower = await analyze({ kind: 'message', text: MID, lang: 'en', options: OFF });
    expect(lower.riskScore).toBe(base.riskScore);
    expect(lower.verdict).toBe('scam');
    expect(['high', 'critical']).toContain(lower.severity);

    loadCalibration.mockReturnValue(
      cal({ thresholds: { scam: 99, suspicious: Math.min(98, base.riskScore + 1) } }),
    );
    const higher = await analyze({ kind: 'message', text: MID, lang: 'en', options: OFF });
    expect(higher.verdict).toBe('no_signs');
    expect(['none', 'low']).toContain(higher.severity);
  });

  it('uses C’s fusion weights', async () => {
    const msg = 'Pay the fine now at http://198.51.100.7/pay-fine or face arrest';
    loadCalibration.mockReturnValue(cal({ fusion: { rules: 1, model: 0, links: 0 } }));
    const rulesOnly = await analyze({ kind: 'message', text: msg, lang: 'en', options: OFF });
    loadCalibration.mockReturnValue(cal({ fusion: { rules: 0.01, model: 0, links: 1 } }));
    const linksHeavy = await analyze({ kind: 'message', text: msg, lang: 'en', options: OFF });
    const share = (r: typeof rulesOnly, l: string) => r.layers.find((x) => x.layer === l)!.share;
    expect(share(rulesOnly, 'links')).toBe(0);
    expect(share(linksHeavy, 'links')).toBeGreaterThan(share(linksHeavy, 'rules'));
  });

  it('scoreLive uses the same thresholds', () => {
    const live = scoreLive(MID, 'en');
    loadCalibration.mockReturnValue(cal({ thresholds: { scam: 2, suspicious: 1 } }));
    expect(scoreLive(MID, 'en').verdict).toBe(live.riskScore >= 2 ? 'scam' : 'suspicious');
  });

  it('falls back to the defaults for invalid values', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const bad of [
      cal({ thresholds: { scam: 40, suspicious: 70 } }),
      cal({ thresholds: { scam: 100, suspicious: 40 } }),
      cal({ fusion: { rules: 0, model: 0.5, links: 0.5 } }),
      cal({ fusion: { rules: 0.5, model: Number.NaN, links: 0.5 } }),
      cal({ aiBlend: 1.5 }),
      null as unknown as Calibration,
    ]) {
      expect(isValidCalibration(bad)).toBe(false);
      loadCalibration.mockReturnValue(bad);
      expect(currentCalibration()).toBe(DEFAULT_CALIBRATION);
    }
    loadCalibration.mockImplementation(() => {
      throw new Error('missing');
    });
    expect(currentCalibration()).toBe(DEFAULT_CALIBRATION);
    expect(isValidCalibration(cal({ thresholds: { scam: 65, suspicious: 35 } }))).toBe(true);
    warn.mockRestore();
  });

  it('keeps severity consistent with the verdict', () => {
    expect(severityOf(66)).toBe('medium');
    expect(severityOf(66, 'scam')).toBe('high');
    expect(severityOf(90, 'scam')).toBe('critical');
    expect(severityOf(38, 'suspicious')).toBe('medium');
    expect(severityOf(45, 'no_signs')).toBe('low');
    expect(severityOf(10, 'no_signs')).toBe('none');
  });
});
