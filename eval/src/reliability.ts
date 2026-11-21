/**
 * Risk reliability (2026-11-22, reporting only): do the risk numbers mean what they say?
 *
 * Runs the full system without AI over the held-out test split and counts, for each risk band, how
 * many messages really were scams. Nothing is tuned from it: the bands are the shipped verdict
 * thresholds (below 40 no warning signs, 40–69 suspicious, 70+ scam) plus ten-point bins for the
 * chart. Never prints or stores message text.
 *
 *   npm run reliability -w @akshi/eval     → packages/content/src/risk-calibration.json
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENGINE_VERSION, analyze, warmup } from '@akshi/engine';
import { MODEL_VERSION } from '@akshi/model';
import { loadRows, REPO } from './data';
import { requestFor } from './harness';

export interface Band {
  from: number;
  /** inclusive */
  to: number;
  messages: number;
  scams: number;
}

export interface Reliability {
  generatedAt: string;
  engineVersion: string;
  modelVersion: string;
  split: 'test';
  messages: number;
  scams: number;
  /** the verdict bands */
  verdictBands: Band[];
  /** ten-point bins, 0–9 … 90–100 */
  bins: Band[];
  /** mean of (risk/100 − is-scam)², lower is better; 0.25 is a coin toss */
  brier: number;
}

export const VERDICT_BANDS: readonly [number, number][] = [
  [0, 39],
  [40, 69],
  [70, 100],
];

export function bandsFor(
  points: readonly { risk: number; scam: boolean }[],
  ranges: readonly [number, number][],
): Band[] {
  return ranges.map(([from, to]) => {
    const inside = points.filter((p) => p.risk >= from && p.risk <= to);
    return { from, to, messages: inside.length, scams: inside.filter((p) => p.scam).length };
  });
}

export function reliability(
  points: readonly { risk: number; scam: boolean }[],
  meta: { engineVersion: string; modelVersion: string; generatedAt: string },
): Reliability {
  const bins = Array.from(
    { length: 10 },
    (_, i) => [i * 10, i === 9 ? 100 : i * 10 + 9] as [number, number],
  );
  const brier =
    points.reduce((s, p) => s + (p.risk / 100 - (p.scam ? 1 : 0)) ** 2, 0) /
    Math.max(1, points.length);
  return {
    ...meta,
    split: 'test',
    messages: points.length,
    scams: points.filter((p) => p.scam).length,
    verdictBands: bandsFor(points, VERDICT_BANDS),
    bins: bandsFor(points, bins),
    brier: Math.round(brier * 10000) / 10000,
  };
}

async function main() {
  const rows = loadRows().filter((r) => r.split === 'test');
  await warmup();
  const points: { risk: number; scam: boolean }[] = [];
  for (const row of rows) {
    const r = await analyze(requestFor(row, 'full_no_ai'));
    points.push({ risk: r.riskScore, scam: row.label === 'scam' });
  }
  const report = reliability(points, {
    engineVersion: ENGINE_VERSION,
    modelVersion: MODEL_VERSION,
    generatedAt: new Date().toISOString(),
  });
  const out = join(REPO, 'packages', 'content', 'src', 'risk-calibration.json');
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  const pct = (b: Band) => (b.messages ? ((b.scams / b.messages) * 100).toFixed(1) + '%' : '—');
  console.log(
    `engine ${ENGINE_VERSION}, model ${MODEL_VERSION}, test split: ${report.messages} messages`,
  );
  for (const b of report.verdictBands)
    console.log(`  risk ${b.from}–${b.to}: ${b.messages} messages, ${pct(b)} scams`);
  console.log(`  Brier score ${report.brier}`);
  console.log(`wrote ${out}`);
}

// run only as a script, not when the tests import the helpers
if (process.argv[1]?.replace(/\\/g, '/').endsWith('eval/src/reliability.ts')) void main();
