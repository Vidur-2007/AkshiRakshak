import { describe, expect, it } from 'vitest';
import { bandsFor, reliability, VERDICT_BANDS } from '../src/reliability';

const meta = { engineVersion: 'x', modelVersion: 'y', generatedAt: 'z' };

describe('reliability', () => {
  it('counts messages and scams per band, edges included', () => {
    const points = [
      { risk: 0, scam: false },
      { risk: 39, scam: true },
      { risk: 40, scam: true },
      { risk: 69, scam: false },
      { risk: 70, scam: true },
      { risk: 100, scam: true },
    ];
    expect(bandsFor(points, VERDICT_BANDS)).toEqual([
      { from: 0, to: 39, messages: 2, scams: 1 },
      { from: 40, to: 69, messages: 2, scams: 1 },
      { from: 70, to: 100, messages: 2, scams: 2 },
    ]);
    const r = reliability(points, meta);
    expect(r.messages).toBe(6);
    expect(r.scams).toBe(4);
    expect(r.bins).toHaveLength(10);
    expect(r.bins.reduce((a, b) => a + b.messages, 0)).toBe(6);
  });

  it('scores perfect, coin-toss and wrong predictions', () => {
    expect(
      reliability(
        [
          { risk: 100, scam: true },
          { risk: 0, scam: false },
        ],
        meta,
      ).brier,
    ).toBe(0);
    expect(
      reliability(
        [
          { risk: 50, scam: true },
          { risk: 50, scam: false },
        ],
        meta,
      ).brier,
    ).toBe(0.25);
    expect(reliability([{ risk: 0, scam: true }], meta).brier).toBe(1);
  });
});
