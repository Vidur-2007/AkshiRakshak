import { describe, expect, it } from 'vitest';
import {
  arcPath,
  GAUGE_END,
  GAUGE_START,
  polar,
  ringOffset,
  scoreToAngle,
  scoreToFraction,
  tickLine,
} from './gauge';

const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-6);

describe('RiskGauge maths', () => {
  it('maps 0–100 linearly onto the 240° sweep and clamps', () => {
    expect(scoreToAngle(0)).toBe(GAUGE_START);
    expect(scoreToAngle(100)).toBe(GAUGE_END);
    expect(scoreToAngle(50)).toBe(0);
    expect(scoreToAngle(40)).toBe(-24);
    expect(scoreToAngle(70)).toBe(48);
    expect(scoreToAngle(-10)).toBe(GAUGE_START);
    expect(scoreToAngle(250)).toBe(GAUGE_END);
    expect(scoreToAngle(Number.NaN)).toBe(GAUGE_START);
  });

  it('measures angles clockwise from 12 o’clock', () => {
    const top = polar(100, 100, 50, 0);
    close(top.x, 100);
    close(top.y, 50);
    const right = polar(100, 100, 50, 90);
    close(right.x, 150);
    close(right.y, 100);
  });

  it('builds a large clockwise arc for the full gauge and a small one for short sweeps', () => {
    const full = arcPath(100, 100, 80, GAUGE_START, GAUGE_END);
    expect(full).toMatch(/^M [\d.-]+ [\d.-]+ A 80 80 0 1 1 [\d.-]+ [\d.-]+$/);
    const p0 = polar(100, 100, 80, GAUGE_START);
    expect(full.startsWith(`M ${Math.round(p0.x * 1000) / 1000} `)).toBe(true);
    expect(arcPath(100, 100, 80, -120, -24)).toContain(' 0 0 1 ');
  });

  it('gives the fill fraction and the threshold ticks', () => {
    expect(scoreToFraction(92)).toBe(0.92);
    expect(scoreToFraction(120)).toBe(1);
    const t = tickLine(100, 100, 70, 90, 70);
    const angle = scoreToAngle(70);
    close(t.from.x, polar(100, 100, 70, angle).x);
    close(t.to.y, polar(100, 100, 90, angle).y);
  });

  it('computes ring dash offsets', () => {
    const { circumference, offset } = ringOffset(10, 0.25);
    close(circumference, 20 * Math.PI);
    close(offset, 15 * Math.PI);
    expect(ringOffset(10, 2).offset).toBe(0);
    close(ringOffset(10, -1).offset, 20 * Math.PI);
  });
});
