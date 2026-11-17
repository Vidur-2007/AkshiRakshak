/**
 * Isolation Forest (Liu, Ting, Zhou 2008) with the parameters of SPEC_C_DATA.md §6.4:
 * 100 trees, subsample ψ = min(256, n), height limit ⌈log2 ψ⌉, score s(x) = 2^(−E[h(x)] / c(ψ)),
 * c(n) = 2H(n−1) − 2(n−1)/n, H(i) = ln(i) + 0.5772156649. A seeded PRNG makes every run identical.
 */

const EULER = 0.5772156649;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Average path length of an unsuccessful search in a binary search tree of n points. */
export function averagePathLength(n: number): number {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return 2 * (Math.log(n - 1) + EULER) - (2 * (n - 1)) / n;
}

type Node = { size: number } | { feature: number; split: number; left: Node; right: Node };

function build(rows: number[][], indices: number[], depth: number, limit: number, rand: () => number): Node {
  if (depth >= limit || indices.length <= 1) return { size: indices.length };
  const dims = rows[0]!.length;
  // features that still vary among these points
  const candidates: number[] = [];
  for (let f = 0; f < dims; f++) {
    const v0 = rows[indices[0]!]![f]!;
    if (indices.some((i) => rows[i]![f]! !== v0)) candidates.push(f);
  }
  if (candidates.length === 0) return { size: indices.length };
  const feature = candidates[Math.floor(rand() * candidates.length)]!;
  let min = Infinity;
  let max = -Infinity;
  for (const i of indices) {
    const v = rows[i]![feature]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const split = min + rand() * (max - min);
  const left: number[] = [];
  const right: number[] = [];
  for (const i of indices) (rows[i]![feature]! < split ? left : right).push(i);
  if (left.length === 0 || right.length === 0) return { size: indices.length };
  return {
    feature,
    split,
    left: build(rows, left, depth + 1, limit, rand),
    right: build(rows, right, depth + 1, limit, rand),
  };
}

function pathLength(node: Node, row: number[]): number {
  let depth = 0;
  let n = node;
  while ('feature' in n) {
    n = row[n.feature]! < n.split ? n.left : n.right;
    depth++;
  }
  return depth + averagePathLength(n.size);
}

export interface ForestOptions {
  trees?: number;
  sampleSize?: number;
  seed?: number;
}

/** Anomaly score in 0..1 for every row (higher = more unusual). Same input and seed give the same scores. */
export function isolationForestScores(rows: number[][], opts: ForestOptions = {}): number[] {
  const n = rows.length;
  if (n === 0) return [];
  const trees = opts.trees ?? 100;
  const psi = Math.min(opts.sampleSize ?? 256, n);
  if (psi < 2) return rows.map(() => 0.5);
  const limit = Math.ceil(Math.log2(psi));
  const rand = mulberry32(opts.seed ?? 42);
  const all = rows.map((_, i) => i);
  const total = new Float64Array(n);
  for (let t = 0; t < trees; t++) {
    // partial Fisher–Yates: the first psi entries are a sample without replacement
    const pool = all.slice();
    for (let i = 0; i < psi; i++) {
      const j = i + Math.floor(rand() * (n - i));
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    const tree = build(rows, pool.slice(0, psi), 0, limit, rand);
    for (let i = 0; i < n; i++) total[i]! += pathLength(tree, rows[i]!);
  }
  const c = averagePathLength(psi);
  return Array.from(total, (sum) => Math.pow(2, -(sum / trees) / c));
}
