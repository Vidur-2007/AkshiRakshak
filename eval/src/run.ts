/**
 * Evaluation harness (SPEC_C_DATA.md §5). Runs the shipped TypeScript engine over the dataset and writes
 * the report the Proof page shows.
 *
 *   npm run eval                      test split → packages/content/src/eval-report.json + eval/out/report.md
 *   npm run eval -w @akshi/eval -- --split val   validation split → eval/out/ only (for tuning; never published)
 *   npm run eval -w @akshi/eval -- --limit 50    first 50 messages of the split (quick check; never published)
 *   npm run eval -w @akshi/eval -- --ai          also run full_ai_sample on up to 100 test messages (needs npm run dev:api
 *                                     and your own keys in .env; one request every 4 seconds)
 *
 * Message text is never written to the output.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EvalReportSchema } from '@akshi/contracts';
import { ENGINE_VERSION, analyze, setApiBase, warmup } from '@akshi/engine';
import { SAMPLE_STATEMENTS, analyzeStatement, parseStatementCsv } from '@akshi/insights';
import { MODEL_VERSION } from '@akshi/model';
import { REPO, loadRows, loadStatementLabels } from './data';
import type { ConfigName, ReportInput, StatementRun } from './harness';
import { buildReport, runConfig, toMarkdown } from './harness';

const AI_SAMPLE = 100;
const AI_PAUSE_MS = 4000;
const PUBLISHED = join(REPO, 'packages', 'content', 'src', 'eval-report.json');
const OUT_DIR = join(REPO, 'eval', 'out');

function args() {
  const argv = process.argv.slice(2);
  const value = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const split = value('--split') ?? 'test';
  if (split !== 'test' && split !== 'val') throw new Error('--split must be test or val');
  const limit = value('--limit') ? Number(value('--limit')) : undefined;
  if (limit !== undefined && !(Number.isInteger(limit) && limit > 0)) throw new Error('--limit must be a positive whole number');
  return { split: split as 'test' | 'val', limit, ai: argv.includes('--ai'), apiBase: value('--api') ?? 'http://localhost:3001' };
}

async function main() {
  const opts = args();
  const all = loadRows();
  const count = (split: string) => all.filter((r) => r.split === split).length;
  let rows = all.filter((r) => r.split === opts.split);
  if (opts.limit) rows = rows.slice(0, opts.limit);
  const handwrittenRows = all.filter((r) => r.split === 'handwritten');
  console.log('engine ' + ENGINE_VERSION + ', model ' + MODEL_VERSION + ', split ' + opts.split + ': ' + rows.length + ' messages');

  await warmup();
  const configs: ReportInput['configs'] = {};
  for (const name of ['rules_only', 'rules_model', 'full_no_ai'] as ConfigName[]) {
    configs[name] = await runConfig(rows, name, analyze);
    console.log('  ' + name + ' done');
  }
  // only the full system is run on the handwritten set, and only when publishing: it is never used for tuning
  const handwritten =
    handwrittenRows.length > 0 && opts.split === 'test' ? await runConfig(handwrittenRows, 'full_no_ai', analyze) : null;

  const extraNotes: string[] = [];
  if (opts.ai) {
    setApiBase(opts.apiBase);
    const sample = all.filter((r) => r.split === 'test').slice(0, AI_SAMPLE);
    console.log('  full_ai_sample: ' + sample.length + ' messages, about ' + Math.ceil((sample.length * AI_PAUSE_MS) / 60000) + ' minutes');
    const outcomes = await runConfig(sample, 'full_ai_sample', analyze, { pauseMs: AI_PAUSE_MS });
    configs.full_ai_sample = outcomes;
    const used = outcomes.filter((o) => o.aiUsed).length;
    extraNotes.push('AI second opinion: asked for on ' + sample.length + ' test messages, answered on ' + used + '. Only the metrics were kept, not the replies.');
  }

  const statements: StatementRun[] = [];
  for (const sample of SAMPLE_STATEMENTS) {
    const labels = loadStatementLabels(sample.id);
    if (!labels) continue;
    const { txns } = parseStatementCsv(sample.csv);
    const analysis = analyzeStatement(txns, 'en');
    statements.push({ id: sample.id, txns: txns.length, anomalies: analysis.anomalies, labels });
  }

  const input: ReportInput = {
    generatedAt: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
    modelVersion: MODEL_VERSION,
    split: opts.split,
    configs,
    handwritten,
    statements,
    datasetSizes: { train: count('train'), val: count('val'), test: count('test'), handwritten: count('handwritten') },
    extraNotes,
  };
  const built = buildReport(input);
  // known weak spots, computed from this run: the lowest-F1 language and every category under 80% recall
  const pct = (x: number) => Math.round(x * 1000) / 10 + '%';
  const weakLang = [...built.perLang].sort((a, b) => a.f1 - b.f1)[0];
  const weakCats = built.perCategory.filter((c) => c.support > 0 && c.recall < 0.8).sort((a, b) => a.recall - b.recall);
  const weak: string[] = [];
  if (weakLang) weak.push('weakest language ' + weakLang.lang + ' (F1 ' + pct(weakLang.f1) + ', precision ' + pct(weakLang.precision) + ')');
  if (weakCats.length) weak.push('scam types caught less than 80% of the time: ' + weakCats.map((c) => c.category + ' ' + pct(c.recall)).join(', '));
  if (weak.length) built.notes.push('Known weak spots in this run: ' + weak.join('; ') + '.');
  const report = EvalReportSchema.parse(built);
  const publish = opts.split === 'test' && !opts.limit;
  mkdirSync(OUT_DIR, { recursive: true });
  const suffix = publish ? '' : '-' + opts.split + (opts.limit ? '-first' + opts.limit : '');
  writeFileSync(join(OUT_DIR, 'report' + suffix + '.md'), toMarkdown(report, input));
  writeFileSync(join(OUT_DIR, 'report' + suffix + '.json'), JSON.stringify(report, null, 2) + '\n');
  if (publish) writeFileSync(PUBLISHED, JSON.stringify(report, null, 2) + '\n');

  const o = report.overall;
  console.log('full_no_ai: precision ' + o.precision + ', recall ' + o.recall + ', F1 ' + o.f1 + ', false-alarm rate ' + o.fpr);
  console.log('statements: ' + JSON.stringify(report.statements));
  console.log('wrote eval/out/report' + suffix + '.md' + (publish ? ' and packages/content/src/eval-report.json' : ' (not published)'));
  report.notes.slice(0, 1).forEach((n) => console.log('note: ' + n));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
