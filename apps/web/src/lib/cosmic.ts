/**
 * The landing intro's point cloud (design 2026-11-20, "cosmic web" look): message dust drawn along
 * filaments from a bright core out to glowing hub nodes, a few red "trap" points among them, and a
 * target shape (the shield-eye) every non-trap point settles into as the person scrolls.
 *
 * Pure and seeded, so it is testable and the same on every visit. The renderer is
 * components/home/CosmicIntro.tsx (WebGL, no library).
 */

/** 0 = dust, 1 = hub node (purple glow), 2 = trap (turns red, then is pushed away). */
export type PointKind = 0 | 1 | 2;

export interface CosmicCloud {
  count: number;
  /** start positions, xyz per point */
  start: Float32Array;
  /** shield-eye positions, xyz per point (filled by `settleInto`) */
  target: Float32Array;
  kind: Float32Array;
  seed: Float32Array;
}

/** Small deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TRAP_SHARE = 0.08;
export const HUB_COUNT = 70;

/** Build the start cloud: filaments from the core to hubs, a halo of loose dust, hubs, traps. */
export function buildCloud(count: number, seed = 7): CosmicCloud {
  const r = rng(seed);
  const start = new Float32Array(count * 3);
  const kind = new Float32Array(count);
  const seeds = new Float32Array(count);
  const hubs: [number, number, number][] = [];
  for (let h = 0; h < HUB_COUNT; h++) {
    const u = r() * 2 - 1;
    const th = r() * Math.PI * 2;
    const rad = 8 + Math.cbrt(r()) * 26;
    const q = Math.sqrt(1 - u * u);
    hubs.push([rad * q * Math.cos(th), rad * u * 0.75, rad * q * Math.sin(th)]);
  }
  // each hub's three nearest hubs: filaments run hub to hub, which reads as a web
  const d2 = (a: number[], b: number[]) =>
    (a[0]! - b[0]!) ** 2 + (a[1]! - b[1]!) ** 2 + (a[2]! - b[2]!) ** 2;
  const nearest = hubs.map((h) =>
    hubs
      .map((o, j) => [d2(h, o), j] as const)
      .sort((x, y) => x[0] - y[0])
      .slice(1, 4)
      .map(([, j]) => hubs[j]!),
  );
  for (let i = 0; i < count; i++) {
    seeds[i] = r();
    let x: number;
    let y: number;
    let z: number;
    if (i < HUB_COUNT) {
      [x, y, z] = hubs[i]!;
      kind[i] = 1;
    } else {
      const roll = r();
      if (roll < 0.68) {
        // along a filament: hub to a neighbouring hub, or (a quarter of them) the core to a hub
        const h = Math.floor(r() * HUB_COUNT);
        const a = hubs[h]!;
        const b = r() < 0.25 ? ([0, 0, 0] as const) : nearest[h]![Math.floor(r() * 3)]!;
        const t = r();
        const j = 0.35 + Math.sin(t * Math.PI) * 0.5;
        x = a[0] + (b[0] - a[0]) * t + (r() - 0.5) * j;
        y = a[1] + (b[1] - a[1]) * t + (r() - 0.5) * j;
        z = a[2] + (b[2] - a[2]) * t + (r() - 0.5) * j;
      } else if (roll < 0.82) {
        // bright core
        const rad = Math.cbrt(r()) * 4;
        const u = r() * 2 - 1;
        const th = r() * Math.PI * 2;
        const q = Math.sqrt(1 - u * u);
        x = rad * q * Math.cos(th);
        y = rad * u;
        z = rad * q * Math.sin(th);
      } else {
        // loose halo
        const rad = 9 + Math.cbrt(r()) * 30;
        const u = r() * 2 - 1;
        const th = r() * Math.PI * 2;
        const q = Math.sqrt(1 - u * u);
        x = rad * q * Math.cos(th);
        y = rad * u * 0.75;
        z = rad * q * Math.sin(th);
      }
      kind[i] = r() < TRAP_SHARE ? 2 : 0;
    }
    start[i * 3] = x;
    start[i * 3 + 1] = y;
    start[i * 3 + 2] = z;
  }
  return { count, start, target: new Float32Array(count * 3), kind, seed: seeds };
}

/**
 * Fill `cloud.target` with points on the shield-eye: half on the shield outline, a third on the
 * eye, the rest on the iris ring and pupil. `pointOn(shape, t)` samples a 200×200 design-space
 * outline at fraction t (0–1); the browser passes SVGPathElement.getPointAtLength.
 */
export function settleInto(
  cloud: CosmicCloud,
  pointOn: (shape: 'shield' | 'eye', t: number) => { x: number; y: number },
  seed = 11,
): void {
  const r = rng(seed);
  const map = (x: number, y: number) => [
    ((x - 100) / 100) * 12,
    (-(y - 100) / 100) * 12 + 0.6,
    (r() - 0.5) * 0.8,
  ];
  for (let i = 0; i < cloud.count; i++) {
    const k = r();
    let p: number[];
    if (k < 0.5) {
      const pt = pointOn('shield', r());
      p = map(pt.x + (r() - 0.5) * 2, pt.y + (r() - 0.5) * 2);
    } else if (k < 0.8) {
      const pt = pointOn('eye', r());
      p = map(pt.x + (r() - 0.5) * 1.6, pt.y + (r() - 0.5) * 1.6);
    } else {
      const a = r() * Math.PI * 2;
      const rr = k < 0.93 ? 16 + (r() - 0.5) * 2 : Math.sqrt(r()) * 7;
      p = map(100 + Math.cos(a) * rr, 100 + Math.sin(a) * rr);
    }
    cloud.target[i * 3] = p[0]!;
    cloud.target[i * 3 + 1] = p[1]!;
    cloud.target[i * 3 + 2] = p[2]!;
  }
}

/** Smoothstep between a and b. */
export function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Scene state for a scroll progress p (0–1) and time t (s): what the shader and captions read. */
export function sceneAt(p: number) {
  const red = smooth(0.22, 0.36, p);
  const morph = smooth(0.5, 0.78, p);
  const push = smooth(0.52, 0.74, p);
  const camZ =
    p < 0.3
      ? 72 + (34 - 72) * smooth(0, 0.3, p)
      : p < 0.55
        ? 34 + (30 - 34) * smooth(0.3, 0.55, p)
        : p < 0.84
          ? 30 + (33 - 30) * smooth(0.55, 0.84, p)
          : 33 + (9 - 33) * smooth(0.84, 1, p);
  return { red, morph, push, camZ };
}

/** Caption windows: [start, end] of scroll progress. */
export const CAPTIONS: readonly [number, number][] = [
  [0.03, 0.22],
  [0.27, 0.48],
  [0.6, 0.82],
];

export function captionOpacity(p: number, [a, b]: readonly [number, number]): number {
  return Math.min(smooth(a, a + 0.05, p), 1 - smooth(b - 0.05, b, p));
}
