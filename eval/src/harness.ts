import type { AnalysisResult, AnalyzeRequest, EvalReport, Lang, ScamCategory, Verdict } from '@akshi/contracts';
import { LANGS } from '@akshi/contracts';
import type { Row } from './data';
import type { Outcome, StatementLabel } from './metrics';
import { confusion, falseAlarmRate, metrics, percentile, recall, scoreStatement } from './metrics';

export type ConfigName = EvalReport['configs'][number]['name'];
type Layers = NonNullable<NonNullable<AnalyzeRequest['options']>['layers']>;

/** Which engine layers each configuration switches on (SPEC_C_DATA.md §5). Network extras are always off. */
export const CONFIG_LAYERS: Record<ConfigName, { layers: Layers; cloudAI: boolean }> = {
  rules_only: { layers: { model: false, links: true, indicators: false, ai: false }, cloudAI: false },
  rules_model: { layers: { model: true, links: true, indicators: false, ai: false }, cloudAI: false },
  full_no_ai: { layers: { model: true, links: true, indicators: true, ai: false }, cloudAI: false },
  full_ai_sample: { layers: { model: true, links: true, indicators: true, ai: true }, cloudAI: true },
};

export type Analyze = (req: AnalyzeRequest) => Promise<AnalysisResult>;

export function requestFor(row: Row, config: ConfigName): AnalyzeRequest {
  const { layers, cloudAI } = CONFIG_LAYERS[config];
  return {
    kind: 'message',
    text: row.text,
    channel: row.channel,
    lang: row.lang,
    options: { cloudAI, expandLinks: false, domainAge: false, layers },
  };
}

export interface RowOutcome extends Outcome {
  row: Row;
  riskScore: number;
  category: ScamCategory | null;
  ms: number;
  aiUsed: boolean;
}

/** Runs the engine over the rows, one at a time. `pauseMs` spaces the calls out (used for the AI sample). */
export async function runConfig(
  rows: Row[],
  config: ConfigName,
  analyze: Analyze,
  opts: { pauseMs?: number; now?: () => number } = {},
): Promise<RowOutcome[]> {
  const now = opts.now ?? (() => performance.now());
  const out: RowOutcome[] = [];
  for (const row of rows) {
    const t0 = now();
    const result = await analyze(requestFor(row, config));
    const ms = now() - t0;
    out.push({
      row,
      scam: row.label === 'scam',
      verdict: result.verdict,
      riskScore: result.riskScore,
      category: result.category,
      ms,
      aiUsed: result.aiUsed,
    });
    if (opts.pauseMs) await new Promise((r) => setTimeout(r, opts.pauseMs));
  }
  return out;
}

export interface StatementRun {
  id: string;
  txns: number;
  anomalies: { txnIds: string[]; type: string }[];
  labels: StatementLabel[];
}

export function statementBlock(runs: StatementRun[]): {
  block: NonNullable<EvalReport['statements']> | null;
  typeMatched: number;
  perStatement: { id: string; injected: number; caught: number; typeMatched: number; falseFlags: number; txns: number }[];
} {
  const perStatement = runs.map((r) => ({ id: r.id, txns: r.txns, ...scoreStatement(r.anomalies, r.labels) }));
  if (perStatement.length === 0) return { block: null, typeMatched: 0, perStatement };
  const sum = (key: 'injected' | 'caught' | 'typeMatched' | 'falseFlags' | 'txns') =>
    perStatement.reduce((a, s) => a + s[key], 0);
  return {
    block: {
      injected: sum('injected'),
      caught: sum('caught'),
      falseFlagsPer100: Math.round((sum('falseFlags') * 10000) / Math.max(1, sum('txns'))) / 100,
    },
    typeMatched: sum('typeMatched'),
    perStatement,
  };
}

export interface ReportInput {
  generatedAt: string;
  engineVersion: string;
  modelVersion: string;
  /** which split the main numbers are for: "test" for the published report, "val" while tuning */
  split: 'test' | 'val';
  /** outcomes on that split, per configuration that was run */
  configs: Partial<Record<ConfigName, RowOutcome[]>>;
  /** full_no_ai on the handwritten set, or null when there is none */
  handwritten: RowOutcome[] | null;
  statements: StatementRun[];
  datasetSizes: { train: number; val: number; test: number; handwritten: number };
  extraNotes?: string[];
}

const pct = (n: number) => (n * 100).toFixed(1) + '%';

export function buildReport(input: ReportInput): EvalReport {
  const main = input.configs.full_no_ai;
  if (!main) throw new Error('full_no_ai must be run: it is the headline configuration');
  const overall = metrics(main);
  const scamOnly = metrics(main, true);
  const stmt = statementBlock(input.statements);
  const hard = main.filter((o) => o.row.hard_negative);
  const categories = [...new Set(main.filter((o) => o.scam).map((o) => o.row.category!))].sort();
  const langs: Lang[] = LANGS.filter((l) => main.some((o) => o.row.lang === l));
  const latencies = main.map((o) => o.ms);
  const categoryRight = main.filter((o) => o.scam && o.verdict !== 'no_signs' && o.category === o.row.category).length;
  const flaggedScams = main.filter((o) => o.scam && o.verdict !== 'no_signs').length;

  const notes: string[] = [];
  if (/stub|fixture/i.test(input.engineVersion)) {
    notes.push(
      'NOT A MEASUREMENT: this run used the placeholder engine (' + input.engineVersion +
        '), which does not analyse the text. The message numbers below only show that the harness works. ' +
        'Real numbers come after the engine is merged.',
    );
  }
  notes.push(
    'Message numbers are for the ' + (input.split === 'test' ? 'held-out test' : 'validation') +
      ' split of the synthetic dataset (' + main.length + ' messages). A message counts as flagged when the verdict is "scam" or "suspicious".',
    'Counting only the "scam" verdict as flagged: precision ' + pct(scamOnly.precision) + ', recall ' + pct(scamOnly.recall) +
      ', false-alarm rate ' + pct(scamOnly.fpr) + '.',
    'False-alarm rate on genuine bank, OTP and UPI messages (hard negatives): ' + pct(falseAlarmRate(hard)) + ' of ' + hard.length + '.',
    'The training data is synthetic: every message was generated from templates written for this project. Expect lower numbers on real messages.',
  );
  if (flaggedScams > 0) {
    notes.push('Scam category named correctly for ' + pct(categoryRight / flaggedScams) + ' of the scams that were flagged.');
  }
  if (input.handwritten) {
    const hw = metrics(input.handwritten);
    notes.push(
      'Handwritten set (' + input.handwritten.length + ' messages written by the team, never used for training or tuning): precision ' +
        pct(hw.precision) + ', recall ' + pct(hw.recall) + ', false-alarm rate ' + pct(hw.fpr) + '.',
    );
  } else {
    notes.push('The handwritten test set has not been added yet, so there is no result for it.');
  }
  if (stmt.block) {
    notes.push(
      'Statements: ' + stmt.block.caught + ' of ' + stmt.block.injected + ' planted scenarios flagged (' + stmt.typeMatched +
        ' with the expected anomaly type). The sample statements were written alongside the rules, so this is a check that they work, not an independent measure.',
    );
  }
  if (!input.configs.full_ai_sample) notes.push('The AI second opinion was not part of this run.');
  notes.push(...(input.extraNotes ?? []));

  const order: ConfigName[] = ['rules_only', 'rules_model', 'full_no_ai', 'full_ai_sample'];
  return {
    generatedAt: input.generatedAt,
    engineVersion: input.engineVersion,
    modelVersion: input.modelVersion,
    datasets: [
      { name: 'synthetic-train', size: input.datasetSizes.train, description: 'Synthetic messages used to train the classifier' },
      { name: 'synthetic-val', size: input.datasetSizes.val, description: 'Synthetic messages used to choose settings' },
      { name: 'synthetic-test', size: input.datasetSizes.test, description: 'Held-out synthetic messages (whole template families), four languages' },
      { name: 'handwritten', size: input.datasetSizes.handwritten, description: 'Messages written by the team, never used for training or tuning' },
    ],
    overall,
    handwritten: input.handwritten ? metrics(input.handwritten) : null,
    configs: order.flatMap((name) => {
      const outcomes = input.configs[name];
      return outcomes ? [{ name, metrics: metrics(outcomes), n: outcomes.length }] : [];
    }),
    perCategory: categories.map((category) => {
      const rows = main.filter((o) => o.row.category === category);
      return { category, recall: recall(rows), support: rows.length };
    }),
    perLang: langs.map((lang) => {
      const m = metrics(main.filter((o) => o.row.lang === lang));
      return { lang, precision: m.precision, recall: m.recall, f1: m.f1, support: m.support };
    }),
    fprGenuineBank: falseAlarmRate(hard),
    confusion: confusion(main),
    latency: { p50Ms: Math.round(percentile(latencies, 0.5) * 100) / 100, p95Ms: Math.round(percentile(latencies, 0.95) * 100) / 100 },
    statements: stmt.block,
    notes,
  };
}

const VERDICT_NAMES: Record<Verdict, string> = { scam: 'Scam', suspicious: 'Suspicious', no_signs: 'No warning signs found' };

/** A plain Markdown version of the report for people reading the repository. */
export function toMarkdown(report: EvalReport, input: ReportInput): string {
  const row = (cells: (string | number)[]) => '| ' + cells.join(' | ') + ' |';
  const table = (head: string[], rows: (string | number)[][]) =>
    [row(head), row(head.map(() => '---')), ...rows.map(row)].join('\n');
  const m = (x: { precision: number; recall: number; f1: number }) => [pct(x.precision), pct(x.recall), pct(x.f1)];
  const stmt = statementBlock(input.statements);
  const lines = [
    '# Evaluation report',
    '',
    'Generated ' + report.generatedAt + ' · engine ' + report.engineVersion + ' · model ' + report.modelVersion + ' · split: ' + input.split,
    '',
    '## Notes',
    '',
    ...report.notes.map((n) => '- ' + n),
    '',
    '## Configurations',
    '',
    table(
      ['Configuration', 'Precision', 'Recall', 'F1', 'Accuracy', 'False-alarm rate', 'Messages'],
      report.configs.map((c) => [c.name, ...m(c.metrics), pct(c.metrics.accuracy), pct(c.metrics.fpr), c.n]),
    ),
    '',
    '## By language (full system, no AI)',
    '',
    table(['Language', 'Precision', 'Recall', 'F1', 'Messages'], report.perLang.map((l) => [l.lang, ...m(l), l.support])),
    '',
    '## Recall by scam category (full system, no AI)',
    '',
    table(['Category', 'Recall', 'Scam messages'], report.perCategory.map((c) => [c.category, pct(c.recall), c.support])),
    '',
    '## Verdicts',
    '',
    table(
      ['Really is', ...report.confusion.labels.map((l) => VERDICT_NAMES[l as Verdict] ?? l)],
      [
        ['Scam', ...report.confusion.matrix[0]!],
        ['Genuine', ...report.confusion.matrix[2]!],
      ],
    ),
    '',
    'Latency (full system, no AI): p50 ' + report.latency.p50Ms + ' ms, p95 ' + report.latency.p95Ms + ' ms.',
    '',
    '## Statements',
    '',
    stmt.perStatement.length === 0
      ? 'No sample statements were evaluated.'
      : table(
          ['Statement', 'Transactions', 'Planted scenarios', 'Flagged', 'Type as expected', 'Other flags'],
          stmt.perStatement.map((s) => [s.id, s.txns, s.injected, s.caught, s.typeMatched, s.falseFlags]),
        ),
    '',
  ];
  return lines.join('\n');
}
