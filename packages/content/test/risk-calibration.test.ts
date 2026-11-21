import { describe, expect, it } from 'vitest';
import { EVAL_REPORT, RISK_CALIBRATION } from '../src';

describe('risk-calibration.json', () => {
  it('covers the whole test split, once per band and once per bin', () => {
    const r = RISK_CALIBRATION;
    expect(r.split).toBe('test');
    expect(r.messages).toBe(EVAL_REPORT.datasets.find((d) => d.name === 'synthetic-test')?.size);
    const sum = (bands: { messages: number }[]) => bands.reduce((a, b) => a + b.messages, 0);
    expect(sum(r.verdictBands)).toBe(r.messages);
    expect(sum(r.bins)).toBe(r.messages);
    for (const b of [...r.verdictBands, ...r.bins]) expect(b.scams).toBeLessThanOrEqual(b.messages);
    expect(r.verdictBands.map((b) => [b.from, b.to])).toEqual([
      [0, 39],
      [40, 69],
      [70, 100],
    ]);
    expect(r.brier).toBeGreaterThanOrEqual(0);
    expect(r.brier).toBeLessThan(0.25); // better than a coin toss
  });
});
