/**
 * Error listing for error analysis (SPEC_C_DATA.md §5, Phase 4). Validation split only by default; the
 * test and handwritten splits are refused so nothing is tuned on them.
 *
 *   npm run errors -w @akshi/eval                → eval/out/errors-val.json + a short listing on stdout
 *
 * For each false positive and false negative of full_no_ai: the text, expected label and category, the
 * verdict and score, each layer's own score, and every signal with its source. eval/out/ is gitignored.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyze, warmup } from '@akshi/engine';
import { REPO, loadRows } from './data';
import { requestFor } from './harness';

const OUT_DIR = join(REPO, 'eval', 'out');

async function main() {
  const split = process.argv.includes('--split') ? process.argv[process.argv.indexOf('--split') + 1] : 'val';
  if (split !== 'val' && split !== 'train') throw new Error('error analysis runs on val (or train) only');
  const rows = loadRows().filter((r) => r.split === split);
  await warmup();
  const errors = [];
  for (const row of rows) {
    const res = await analyze(requestFor(row, 'full_no_ai'));
    const flagged = res.verdict !== 'no_signs';
    const scam = row.label === 'scam';
    if (flagged === scam) continue;
    errors.push({
      kind: scam ? 'FN' : 'FP',
      id: row.id,
      family: row.family,
      lang: row.lang,
      channel: row.channel,
      expected: scam ? row.category : 'genuine',
      hardNegative: row.hard_negative,
      verdict: res.verdict,
      riskScore: res.riskScore,
      category: res.category,
      layers: Object.fromEntries(res.layers.map((l) => [l.layer, l.available ? l.score : null])),
      signals: res.signals.map((s) => s.source + ':' + s.id + '(' + s.weight.toFixed(2) + ')'),
      text: row.text,
    });
  }
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'errors-' + split + '.json'), JSON.stringify(errors, null, 2) + '\n');
  for (const e of errors) {
    console.log(
      [e.kind, e.lang, e.expected, e.verdict + ' ' + e.riskScore, JSON.stringify(e.layers), e.signals.join(' '), e.family].join(' | '),
    );
    console.log('    ' + e.text.replace(/\s+/g, ' ').slice(0, 220));
  }
  console.log(errors.filter((e) => e.kind === 'FP').length + ' false positives, ' + errors.filter((e) => e.kind === 'FN').length + ' false negatives of ' + rows.length);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
