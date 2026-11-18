import { describe, expect, it } from 'vitest';
import {
  dayKey,
  dotRadius,
  inrShort,
  lastDays,
  linear,
  log10Scale,
  logTicks,
  niceMax,
} from './charts';

describe('chart maths', () => {
  it('maps linearly and on a log scale', () => {
    const s = linear(0, 100, 0, 200);
    expect(s(50)).toBe(100);
    const l = log10Scale(100, 100000, 300, 0);
    expect(l(100)).toBe(300);
    expect(l(100000)).toBe(0);
    expect(Math.round(l(10000))).toBe(100);
    expect(l(0)).toBe(300);
  });

  it('gives log ticks and nice maxima', () => {
    expect(logTicks(420, 48000)).toEqual([100, 1000, 10000, 100000]);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(23)).toBe(25);
    expect(niceMax(0)).toBe(1);
  });

  it('formats rupees the Indian way', () => {
    expect(inrShort(950)).toBe('₹950');
    expect(inrShort(1234)).toBe('₹1.2k');
    expect(inrShort(48000)).toBe('₹48k');
    expect(inrShort(150000)).toBe('₹1.5L');
    expect(inrShort(20000000)).toBe('₹2Cr');
  });

  it('sizes dots by the square root of the amount', () => {
    expect(dotRadius(0, 100)).toBe(3);
    expect(dotRadius(100, 100)).toBe(11);
    expect(dotRadius(25, 100)).toBe(7);
    expect(dotRadius(5, 0)).toBe(3);
  });

  it('lists the last n days oldest first', () => {
    expect(lastDays(3, new Date(2026, 10, 2))).toEqual(['2026-10-31', '2026-11-01', '2026-11-02']);
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
