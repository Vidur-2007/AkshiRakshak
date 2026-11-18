/**
 * Reporting only: full_no_ai metrics on the test split, separately for the families that existed at the
 * first real eval (Merge 1 rehearsal, 433 messages) and the families added in Phase 4. Prints numbers by
 * subset, language and hard-negative flag; never prints message text. Nothing is tuned from it.
 *
 *   npx tsx eval/src/compare-subsets.ts <old messages.jsonl> [--calibration <path to calibration.json>]
 */
import { readFileSync } from 'node:fs';
import { analyze, warmup } from '@akshi/engine';
import { loadRows } from './data';
import { requestFor } from './harness';
import { metrics, falseAlarmRate } from './metrics';
import type { RowOutcome } from './harness';

async function main() {
  const oldFile = process.argv[2];
  if (!oldFile) throw new Error('usage: compare-subsets.ts <old messages.jsonl>');
  const oldFamilies = new Set(
    readFileSync(oldFile, 'utf8').split('\n').filter(Boolean).map((l) => (JSON.parse(l) as { family: string }).family),
  );
  const rows = loadRows().filter((r) => r.split === 'test');
  await warmup();
  const out: RowOutcome[] = [];
  for (const row of rows) {
    const r = await analyze(requestFor(row, 'full_no_ai'));
    out.push({ row, scam: row.label === 'scam', verdict: r.verdict, riskScore: r.riskScore, category: r.category, ms: 0, aiUsed: false });
  }
  const pct = (x: number) => (x * 100).toFixed(1) + '%';
  const line = (name: string, o: RowOutcome[]) => {
    const m = metrics(o);
    const hard = o.filter((x) => !x.scam && x.row.hard_negative);
    console.log(
      name.padEnd(28) + ' n=' + String(o.length).padStart(3) + '  P ' + pct(m.precision) + '  R ' + pct(m.recall) + '  F1 ' + pct(m.f1) +
        '  FPR ' + pct(m.fpr) + '  bank FPR ' + pct(falseAlarmRate(hard)) + ' of ' + hard.length,
    );
  };
  const subsets = { 'original families': out.filter((o) => oldFamilies.has(o.row.family)), 'Phase 4 families': out.filter((o) => !oldFamilies.has(o.row.family)) };
  line('all test', out);
  for (const [name, o] of Object.entries(subsets)) {
    line(name, o);
    for (const lang of ['en', 'hi', 'te', 'bn']) line('  ' + name.split(' ')[0] + ' ' + lang, o.filter((x) => x.row.lang === lang));
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
