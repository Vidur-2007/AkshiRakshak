/**
 * ShieldCore geometry (§5.1), drawn with Canvas 2D instead of three.js (the human
 * chose this over a ~249 KB gzipped WebGL dependency). Points sit on a Fibonacci
 * lattice, which spaces them evenly like an icosphere's vertices.
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** `n` evenly spread unit vectors. */
export function fibonacciSphere(n: number): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN * i;
    out.push({ x: Math.cos(theta) * r, y, z: Math.sin(theta) * r });
  }
  return out;
}

export function rotate(p: Vec3, yaw: number, pitch: number): Vec3 {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x1 = p.x * cy + p.z * sy;
  const z1 = -p.x * sy + p.z * cy;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return { x: x1, y: p.y * cp - z1 * sp, z: p.y * sp + z1 * cp };
}

/** Perspective projection; `depth` 0 (back) … 1 (front) for size and alpha. */
export function project(p: Vec3, cx: number, cy: number, radius: number, camera = 3) {
  const scale = camera / (camera - p.z);
  return {
    x: cx + p.x * radius * scale,
    y: cy + p.y * radius * scale,
    depth: (p.z + 1) / 2,
    scale,
  };
}

/** Which ring pulse a live score change should fire: amber at 40, red at 70. */
export function crossedThreshold(prev: number, next: number): 'warn' | 'scam' | null {
  if (prev < 70 && next >= 70) return 'scam';
  if (prev < 40 && next >= 40) return 'warn';
  return null;
}

/** Linear blend of two #rrggbb colours. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const k = Math.max(0, Math.min(1, t));
  const ch = (shift: number) =>
    Math.round(((pa >> shift) & 255) * (1 - k) + ((pb >> shift) & 255) * k);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/** Points for a tier: high 6,000, mid 2,500, low 0 (static poster). */
export const SHIELD_POINTS = { high: 6000, mid: 2500, low: 0 } as const;

/** Token colours as hex for the canvas (CSS variables cannot be read per frame cheaply). */
export const SHIELD_COLORS = {
  brand: '#3de0ff',
  warn: '#f5a524',
  scam: '#ff3b5c',
  safe: '#22c55e',
} as const;
