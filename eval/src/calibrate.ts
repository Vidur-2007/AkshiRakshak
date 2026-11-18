/**
 * Calibration search (SPEC_C_DATA.md §4.6). Validation split only.
 *
 *   npm run calibrate -w @akshi/eval              → prints the choice, writes eval/out/calibration-grid.json
 *   npm run calibrate -w @akshi/eval -- --write   → also writes packages/model/model/calibration.json
 *
 * analyze() runs once per message (full system, no AI) with the calibration that is currently shipped. Each
 * result carries every layer's own score, so the fusion of SPEC.md §8.2 (packages/engine/src/pipeline/fusion.ts)
 * is recomputed here for every grid point without rerunning the engine. The floor that rule combinations
 * apply is recovered from the shipped result: if the shipped score is above the shipped weighted score, the
 * difference came from a floor. The recomputation is checked against the engine on every message before the
 * search starts, and the chosen values should be confirmed with `npm run eval -w @akshi/eval -- --split val`.
 *
 * Grid: fusion weights in steps of 0.05 summing to 1 with rules > 0 (the engine divides by the sum, so only
 * the ratios matter); suspicious threshold 30–50 and scam threshold 60–80 in steps of 5.
 * Objective: highest F1 (scam or suspicious counts as flagged) with false alarms on genuine bank, OTP and UPI
 * messages (hard negatives) ≤ 3%, suspicious ≤ 45 (the engine's 45-point floors), and among points within
 * 0.005 F1 of the best, the one that leans least on the model (see the guard comment below).
 * The scam threshold does not change flagged/not flagged. It stays at the spec default (70) unless a genuine
 * validation message reaches it, then it moves up to the next step above the highest genuine score.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { analyze, warmup } from '@akshi/engine';
import { MODEL_VERSION, loadCalibration } from '@akshi/model';
import { REPO, loadRows } from './data';
import { requestFor } from './harness';

interface Point {
  scam: boolean;
  hard: boolean;
  rules: number;
  model: number | null;
  links: number | null;
  indicators: number | null;
  floor: number;
  shipped: number;
}

type Weights = { rules: number; model: number; links: number };
const DEFAULTS = { thresholds: { scam: 70, suspicious: 40 }, fusion: { rules: 0.45, model: 0.35, links: 0.2 } };
const MAX_FPR_BANK = 0.03;

function score(p: Point, w: Weights): number {
  const parts: [number, number][] = [[w.rules, p.rules]];
  if (p.model !== null) parts.push([w.model, p.model]);
  if (p.links !== null) parts.push([w.links, p.links]);
  const wSum = parts.reduce((a, [x]) => a + x, 0) || 1;
  const weighted = parts.reduce((a, [x, s]) => a + x * s, 0) / wSum;
  const base = p.indicators !== null ? Math.max(weighted, p.indicators) : weighted;
  return Math.round(Math.min(100, Math.max(0, Math.max(base, p.floor))));
}

function evaluate(points: Point[], w: Weights, suspicious: number) {
  let tp = 0, fp = 0, fn = 0, hardFp = 0, hardN = 0;
  for (const p of points) {
    const flagged = score(p, w) >= suspicious;
    if (p.scam) {
      if (flagged) tp++;
      else fn++;
    } else if (flagged) fp++;
    if (p.hard && !p.scam) {
      hardN++;
      if (flagged) hardFp++;
    }
  }
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision, recall, f1, fprBank: hardN ? hardFp / hardN : 0, fp, fn };
}

const r4 = (x: number) => Math.round(x * 10000) / 10000;

async function main() {
  const shipped = loadCalibration();
  const rows = loadRows().filter((r) => r.split === 'val');
  await warmup();
  const points: Point[] = [];
  let mismatches = 0;
  for (const row of rows) {
    const res = await analyze(requestFor(row, 'full_no_ai'));
    const layer = (name: string) => res.layers.find((l) => l.layer === name);
    const urls = layer('links');
    const upi = layer('upi');
    const linksOn = Boolean(urls?.available || upi?.available);
    const ind = layer('indicators');
    const p: Point = {
      scam: row.label === 'scam',
      hard: row.hard_negative,
      rules: layer('rules')?.score ?? 0,
      model: layer('model')?.available ? (layer('model')?.score ?? 0) : null,
      links: linksOn ? Math.max(urls?.score ?? 0, upi?.score ?? 0) : null,
      indicators: ind?.available ? ind.score : null,
      floor: 0,
      shipped: res.riskScore,
    };
    // the report rounds the rules score; its share of the final score gives the exact value back
    const rulesLayer = layer('rules');
    if (rulesLayer && rulesLayer.share > 0 && rulesLayer.share < 1 && res.riskScore > 0) {
      const f = shipped.fusion;
      const wSum = f.rules + (p.model !== null ? f.model : 0) + (p.links !== null ? f.links : 0);
      const exact = (rulesLayer.share * res.riskScore * wSum) / f.rules;
      if (Math.abs(exact - p.rules) <= 0.5) p.rules = exact;
    }
    const noFloor = score(p, shipped.fusion);
    if (res.riskScore > noFloor) p.floor = res.riskScore;
    if (score(p, shipped.fusion) !== res.riskScore) {
      mismatches++;
      if (process.env.DEBUG_CAL) console.log(JSON.stringify({ ...p, recomputed: score(p, shipped.fusion), layers: res.layers, kind: res.kind, signals: res.signals.map((s) => s.id) }));
    }
    points.push(p);
  }
  console.log('model ' + MODEL_VERSION + ', ' + points.length + ' validation messages, recomputation mismatches: ' + mismatches);
  if (mismatches > 0) throw new Error('the offline fusion does not reproduce the engine; check fusion.ts for changes');

  const steps = Array.from({ length: 20 }, (_, i) => (i + 1) / 20);
  const grid: { w: Weights; suspicious: number; m: ReturnType<typeof evaluate> }[] = [];
  for (const rulesW of steps)
    for (const modelW of [0, ...steps]) {
      const linksW = Math.round((1 - rulesW - modelW) * 100) / 100;
      if (linksW < 0) continue;
      const w = { rules: rulesW, model: modelW, links: linksW };
      for (const suspicious of [30, 35, 40, 45, 50]) grid.push({ w, suspicious, m: evaluate(points, w, suspicious) });
    }
  const distance = (g: (typeof grid)[number]) =>
    Math.abs(g.w.rules - DEFAULTS.fusion.rules) + Math.abs(g.w.model - DEFAULTS.fusion.model) +
    Math.abs(g.w.links - DEFAULTS.fusion.links) + Math.abs(g.suspicious - DEFAULTS.thresholds.suspicious) / 100;
  // Guard on top of §4.6: suspicious ≤ 45, so the engine's 45-point floors (ASKS_OTP, TOO_GOOD_RETURNS:
  // "a message that asks for an OTP must never read No warning signs found") keep flagging.
  // If no guarded point meets the 3% limit, the guarded points with the fewest bank false alarms are kept
  // and constraintMet is false (the remaining false alarms then come from the rules, not the weights).
  // Among the kept points within 0.005 F1 of the best, the one that leans least on the model (highest
  // rules/model ratio) is chosen: validation comes from the same generator as training, so the model's
  // share is the part most likely to be overfitted. "both" (rules ≥ model as well) is reported for comparison.
  type G = (typeof grid)[number];
  const byF1 = (a: G, b: G) => b.m.f1 - a.m.f1 || b.m.precision - a.m.precision || distance(a) - distance(b);
  const bestOf = (pool: G[]) => {
    const within = pool.filter((g) => g.m.fprBank <= MAX_FPR_BANK).sort(byF1);
    if (within.length) return { g: within[0]!, met: true, within };
    const sorted = [...pool].sort((a, b) => a.m.fprBank - b.m.fprBank || byF1(a, b));
    return { g: sorted[0]!, met: false, within: sorted };
  };
  const guards = {
    none: () => true,
    thresholdOnly: (g: G) => g.suspicious <= 45,
    both: (g: G) => g.suspicious <= 45 && g.w.rules >= g.w.model,
  };
  const show = (r: ReturnType<typeof bestOf>) => ({
    ...r.g.w, suspicious: r.g.suspicious, constraintMet: r.met,
    f1: r4(r.g.m.f1), precision: r4(r.g.m.precision), recall: r4(r.g.m.recall), fprBank: r4(r.g.m.fprBank),
  });
  const alternatives = Object.fromEntries(Object.entries(guards).map(([k, f]) => [k, show(bestOf(grid.filter(f)))]));
  const chosenRun = bestOf(grid.filter(guards.thresholdOnly));
  const floorFpr = chosenRun.g.m.fprBank;
  const ok = chosenRun.within
    .filter((g) => (chosenRun.met || g.m.fprBank === floorFpr) && g.m.f1 >= chosenRun.g.m.f1 - 0.005)
    .sort((a, b) => b.w.rules / Math.max(b.w.model, 0.05) - a.w.rules / Math.max(a.w.model, 0.05) || byF1(a, b));
  const best = ok[0]!;

  // scam threshold: the default unless a genuine validation message reaches it
  const genuineMax = Math.max(0, ...points.filter((p) => !p.scam).map((p) => score(p, best.w)));
  const scamThreshold = [70, 75, 80].find((t) => t > genuineMax) ?? 80;
  const scamOnlyRecall = points.filter((p) => p.scam && score(p, best.w) >= scamThreshold).length / points.filter((p) => p.scam).length;

  const atDefaults = evaluate(points, DEFAULTS.fusion, DEFAULTS.thresholds.suspicious);
  const calibration = {
    version: MODEL_VERSION,
    thresholds: { scam: scamThreshold, suspicious: best.suspicious },
    fusion: best.w,
    aiBlend: shipped.aiBlend,
  };
  const summary = {
    model: MODEL_VERSION,
    messages: points.length,
    atDefaults: Object.fromEntries(Object.entries(atDefaults).map(([k, v]) => [k, r4(v)])),
    chosen: { ...calibration, metrics: Object.fromEntries(Object.entries(best.m).map(([k, v]) => [k, r4(v)])) },
    genuineMaxScore: genuineMax,
    scamOnlyRecall: r4(scamOnlyRecall),
    top10: ok.slice(0, 10).map((g) => ({ ...g.w, suspicious: g.suspicious, f1: r4(g.m.f1), precision: r4(g.m.precision), fprBank: r4(g.m.fprBank) })),
    constraintMet: chosenRun.met,
    alternatives,
    pointsSearched: grid.length,
    pointsWithinConstraint: grid.filter((g) => g.m.fprBank <= MAX_FPR_BANK).length,
  };
  mkdirSync(join(REPO, 'eval', 'out'), { recursive: true });
  writeFileSync(join(REPO, 'eval', 'out', 'calibration-grid.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
  if (process.argv.includes('--write')) {
    writeFileSync(join(REPO, 'packages', 'model', 'model', 'calibration.json'), JSON.stringify(calibration, null, 2) + '\n');
    console.log('wrote packages/model/model/calibration.json');
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
