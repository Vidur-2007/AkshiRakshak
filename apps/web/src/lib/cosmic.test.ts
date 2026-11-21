import { describe, expect, it } from 'vitest';
import {
  CAPTIONS,
  HUB_COUNT,
  TRAP_SHARE,
  buildCloud,
  captionOpacity,
  rng,
  sceneAt,
  settleInto,
  smooth,
} from './cosmic';

describe('cosmic intro cloud', () => {
  it('is deterministic for a seed', () => {
    const a = buildCloud(2000);
    const b = buildCloud(2000);
    expect(Array.from(a.start)).toEqual(Array.from(b.start));
    expect(Array.from(a.kind)).toEqual(Array.from(b.kind));
    expect(rng(3)()).toBe(rng(3)());
  });

  it('has hubs first, then dust with a small share of traps', () => {
    const c = buildCloud(5000);
    expect(c.start).toHaveLength(15000);
    for (let i = 0; i < HUB_COUNT; i++) expect(c.kind[i]).toBe(1);
    const rest = Array.from(c.kind).slice(HUB_COUNT);
    expect(rest.every((k) => k === 0 || k === 2)).toBe(true);
    const share = rest.filter((k) => k === 2).length / rest.length;
    expect(share).toBeGreaterThan(TRAP_SHARE * 0.6);
    expect(share).toBeLessThan(TRAP_SHARE * 1.4);
    expect(Array.from(c.start).every(Number.isFinite)).toBe(true);
  });

  it('settles every point near the shield-eye', () => {
    const c = buildCloud(1500);
    // a stand-in outline: a circle of radius 80 around the 200×200 centre
    settleInto(c, (_shape, t) => ({
      x: 100 + Math.cos(t * Math.PI * 2) * 80,
      y: 100 + Math.sin(t * Math.PI * 2) * 80,
    }));
    for (let i = 0; i < c.count; i++) {
      expect(Math.abs(c.target[i * 3]!)).toBeLessThan(11);
      expect(Math.abs(c.target[i * 3 + 1]! - 0.6)).toBeLessThan(11);
      expect(Math.abs(c.target[i * 3 + 2]!)).toBeLessThanOrEqual(0.4);
    }
  });
});

describe('cosmic intro timeline', () => {
  it('smooth clamps and eases', () => {
    expect(smooth(0, 1, -1)).toBe(0);
    expect(smooth(0, 1, 2)).toBe(1);
    expect(smooth(0, 1, 0.5)).toBeCloseTo(0.5);
  });

  it('turns traps red before the shield forms, then flies in close', () => {
    const start = sceneAt(0);
    expect(start).toMatchObject({ red: 0, morph: 0, push: 0, camZ: 72 });
    const mid = sceneAt(0.4);
    expect(mid.red).toBe(1);
    expect(mid.morph).toBe(0);
    const end = sceneAt(1);
    expect(end.morph).toBe(1);
    expect(end.push).toBe(1);
    expect(end.camZ).toBeCloseTo(9);
    // the camera path has no jumps
    for (let p = 0.01; p <= 1; p += 0.01) {
      expect(Math.abs(sceneAt(p).camZ - sceneAt(p - 0.01).camZ)).toBeLessThan(3);
    }
  });

  it('shows one caption at a time', () => {
    for (let p = 0; p <= 1; p += 0.01) {
      const visible = CAPTIONS.filter((w) => captionOpacity(p, w) > 0.5);
      expect(visible.length).toBeLessThanOrEqual(1);
    }
    expect(captionOpacity(0.12, CAPTIONS[0]!)).toBe(1);
    expect(captionOpacity(0.9, CAPTIONS[2]!)).toBe(0);
  });
});
