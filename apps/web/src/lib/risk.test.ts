import { describe, expect, it } from 'vitest';
import { clampScore, VERDICT_COLOR, VERDICT_ICON } from './risk';

describe('risk helpers', () => {
  it('clamps scores to an integer 0–100', () => {
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(42.6)).toBe(43);
    expect(clampScore(140)).toBe(100);
    expect(clampScore(Number.NaN)).toBe(0);
  });

  it('has a colour and an icon for every verdict', () => {
    for (const v of ['scam', 'suspicious', 'no_signs'] as const) {
      expect(VERDICT_COLOR[v]).toMatch(/^var\(--risk-/);
      expect(VERDICT_ICON[v]).toBeTruthy();
    }
  });
});
