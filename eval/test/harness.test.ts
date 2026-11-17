import { describe, expect, it } from 'vitest';
import { EvalReportSchema } from '@akshi/contracts';
import type { AnalysisResult, AnalyzeRequest, Verdict } from '@akshi/contracts';
import { SAMPLE_STATEMENTS, analyzeStatement, parseStatementCsv } from '@akshi/insights';
import { loadRows, loadStatementLabels } from '../src/data';
import type { Row } from '../src/data';
import { CONFIG_LAYERS, buildReport, requestFor, runConfig, statementBlock, toMarkdown } from '../src/harness';
import type { ReportInput, StatementRun } from '../src/harness';
import { confusion, falseAlarmRate, metrics, percentile, recall, scoreStatement } from '../src/metrics';
import type { Outcome } from '../src/metrics';

const o = (scam: boolean, verdict: Verdict): Outcome => ({ scam, verdict });
const many = (n: number, scam: boolean, verdict: Verdict) => Array.from({ length: n }, () => o(scam, verdict));

describe('metrics', () => {
  // 10 scams: 6 scam, 2 suspicious, 2 missed. 10 genuine: 1 scam, 1 suspicious, 8 clear.
  const set = [
    ...many(6, true, 'scam'),
    ...many(2, true, 'suspicious'),
    ...many(2, true, 'no_signs'),
    ...many(1, false, 'scam'),
    ...many(1, false, 'suspicious'),
    ...many(8, false, 'no_signs'),
  ];

  it('counts scam and suspicious as flagged by default', () => {
    expect(metrics(set)).toEqual({ precision: 0.8, recall: 0.8, f1: 0.8, accuracy: 0.8, fpr: 0.2, support: 20 });
  });

  it('can count only the scam verdict', () => {
    expect(metrics(set, true)).toEqual({ precision: 0.8571, recall: 0.6, f1: 0.7059, accuracy: 0.75, fpr: 0.1, support: 20 });
  });

  it('gives zeros, not NaN, when a class is missing', () => {
    expect(metrics([])).toEqual({ precision: 0, recall: 0, f1: 0, accuracy: 0, fpr: 0, support: 0 });
    expect(metrics(many(3, false, 'no_signs'))).toMatchObject({ precision: 0, recall: 0, f1: 0, accuracy: 1, fpr: 0 });
    expect(metrics(many(3, true, 'scam'))).toMatchObject({ precision: 1, recall: 1, f1: 1, fpr: 0 });
  });

  it('false-alarm rate, recall, confusion table and percentiles', () => {
    expect(falseAlarmRate(set)).toBe(0.2);
    expect(recall(set)).toBe(0.8);
    expect(falseAlarmRate(many(2, true, 'scam'))).toBe(0);
    expect(confusion(set)).toEqual({
      labels: ['scam', 'suspicious', 'no_signs'],
      matrix: [
        [6, 2, 2],
        [0, 0, 0],
        [1, 1, 8],
      ],
    });
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect([percentile(values, 0.5), percentile(values, 0.95), percentile([7], 0.95), percentile([], 0.5)]).toEqual([50, 95, 7, 0]);
  });

  it('scores a statement against its labels', () => {
    const labels = [
      { txnIds: ['a', 'b'], type: 'burst_small_debits' },
      { txnIds: ['c'], type: 'round_amount_new_payee' },
      { txnIds: ['d'], type: 'duplicate' },
    ];
    const anomalies = [
      { txnIds: ['b'], type: 'burst_small_debits' },
      { txnIds: ['c'], type: 'large_new_payee' },
      { txnIds: ['z'], type: 'odd_hour' },
    ];
    expect(scoreStatement(anomalies, labels)).toEqual({ injected: 3, caught: 2, typeMatched: 1, falseFlags: 1 });
    expect(scoreStatement([], [])).toEqual({ injected: 0, caught: 0, typeMatched: 0, falseFlags: 0 });
  });
});

describe('dataset loading', () => {
  const rows = loadRows();
  it('reads and validates every row', () => {
    expect(rows.length).toBeGreaterThanOrEqual(2500);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    expect(new Set(rows.map((r) => r.split))).toEqual(new Set(['train', 'val', 'test']));
    expect(rows.filter((r) => r.split === 'test').length).toBeGreaterThan(300);
  });
  it('finds the labels of every sample statement', () => {
    for (const s of SAMPLE_STATEMENTS) expect(loadStatementLabels(s.id)).toHaveLength(2);
    expect(loadStatementLabels('no-such-statement')).toBeNull();
  });
});

const row = (id: string, patch: Partial<Row>): Row => ({
  id,
  text: 'text of ' + id,
  lang: 'en',
  script: 'latn',
  channel: 'sms',
  label: 'scam',
  category: 'fake_kyc',
  family: 'f',
  split: 'test',
  source: 'synthetic',
  hard_negative: false,
  notes: '',
  ...patch,
});
const ROWS: Row[] = [
  row('s1', {}),
  row('s2', { lang: 'hi', category: 'upi_collect' }),
  row('s3', { lang: 'te', category: 'upi_collect' }),
  row('g1', { label: 'legit', category: null, hard_negative: true }),
  row('g2', { label: 'legit', category: null, lang: 'hi' }),
  row('g3', { label: 'legit', category: null, lang: 'bn', hard_negative: true }),
];
/** A fake engine: misses s3, raises a false alarm on g3, and is blind without the model layer. */
const fakeAnalyze = async (req: AnalyzeRequest): Promise<AnalysisResult> => {
  const id = req.text!.slice(8);
  const model = req.options?.layers?.model !== false;
  const verdict: Verdict = !model ? 'no_signs' : id === 's1' ? 'scam' : id === 's2' || id === 'g3' ? 'suspicious' : 'no_signs';
  return { verdict, riskScore: verdict === 'scam' ? 90 : 50, category: id === 's1' ? 'fake_kyc' : 'loan_app', aiUsed: false } as AnalysisResult;
};

describe('harness', () => {
  it('builds the request for each configuration with network extras off', () => {
    const req = requestFor(ROWS[1]!, 'rules_only');
    expect(req).toMatchObject({ kind: 'message', text: 'text of s2', lang: 'hi', channel: 'sms' });
    expect(req.options).toEqual({
      cloudAI: false,
      expandLinks: false,
      domainAge: false,
      layers: { model: false, links: true, indicators: false, ai: false },
    });
    expect(CONFIG_LAYERS.rules_model.layers).toMatchObject({ model: true, indicators: false, ai: false });
    expect(CONFIG_LAYERS.full_no_ai.layers).toMatchObject({ model: true, indicators: true, ai: false });
    expect(requestFor(ROWS[0]!, 'full_ai_sample').options).toMatchObject({ cloudAI: true, layers: { ai: true } });
    expect(requestFor(ROWS[0]!, 'full_no_ai').options?.cloudAI).toBe(false);
  });

  it('runs a configuration and records verdict, truth and time per message', async () => {
    let clock = 0;
    const out = await runConfig(ROWS, 'full_no_ai', fakeAnalyze, { now: () => (clock += 5) });
    expect(out.map((x) => [x.row.id, x.scam, x.verdict])).toEqual([
      ['s1', true, 'scam'],
      ['s2', true, 'suspicious'],
      ['s3', true, 'no_signs'],
      ['g1', false, 'no_signs'],
      ['g2', false, 'no_signs'],
      ['g3', false, 'suspicious'],
    ]);
    out.forEach((x) => expect(x.ms).toBe(5));
  });

  const input = async (patch: Partial<ReportInput> = {}): Promise<ReportInput> => ({
    generatedAt: '2026-11-16T00:00:00.000Z',
    engineVersion: '1.2.3',
    modelVersion: '2026.11.16-a',
    split: 'test',
    configs: {
      rules_only: await runConfig(ROWS, 'rules_only', fakeAnalyze),
      full_no_ai: await runConfig(ROWS, 'full_no_ai', fakeAnalyze),
    },
    handwritten: null,
    statements: [],
    datasetSizes: { train: 10, val: 2, test: 6, handwritten: 0 },
    ...patch,
  });

  it('builds a report that fits the contract', async () => {
    const report = EvalReportSchema.parse(buildReport(await input()));
    expect(report.overall).toEqual({ precision: 0.6667, recall: 0.6667, f1: 0.6667, accuracy: 0.6667, fpr: 0.3333, support: 6 });
    expect(report.configs.map((c) => [c.name, c.metrics.recall, c.n])).toEqual([
      ['rules_only', 0, 6],
      ['full_no_ai', 0.6667, 6],
    ]);
    expect(report.perCategory).toEqual([
      { category: 'fake_kyc', recall: 1, support: 1 },
      { category: 'upi_collect', recall: 0.5, support: 2 },
    ]);
    expect(report.perLang.map((l) => [l.lang, l.recall, l.support])).toEqual([
      ['en', 1, 2],
      ['hi', 1, 2],
      ['te', 0, 1],
      ['bn', 0, 1],
    ]);
    expect(report.fprGenuineBank).toBe(0.5); // g3 of the two hard negatives
    expect(report.confusion.matrix).toEqual([
      [1, 1, 1],
      [0, 0, 0],
      [0, 1, 2],
    ]);
    expect(report.handwritten).toBeNull();
    expect(report.statements).toBeNull();
    expect(report.datasets.map((d) => d.size)).toEqual([10, 2, 6, 0]);
    const notes = report.notes.join('\n');
    expect(notes).toContain('held-out test split');
    expect(notes).toContain('Counting only the "scam" verdict');
    expect(notes).toContain('synthetic');
    expect(notes).toContain('handwritten test set has not been added');
    expect(notes).toContain('named correctly for 50.0%');
    expect(notes).not.toContain('NOT A MEASUREMENT');
  });

  it('says plainly when the engine is the placeholder', async () => {
    const report = buildReport(await input({ engineVersion: '0.0.0-stub' }));
    expect(report.notes[0]).toContain('NOT A MEASUREMENT');
  });

  it('reports the handwritten set and the AI sample when they were run', async () => {
    const hw = await runConfig(ROWS.slice(0, 4), 'full_no_ai', fakeAnalyze);
    const ai = await runConfig(ROWS.slice(0, 2), 'full_ai_sample', fakeAnalyze);
    const base = await input();
    const report = EvalReportSchema.parse(buildReport({ ...base, handwritten: hw, configs: { ...base.configs, full_ai_sample: ai } }));
    expect(report.handwritten).toMatchObject({ support: 4, recall: 0.6667, fpr: 0 });
    expect(report.configs.map((c) => c.name)).toEqual(['rules_only', 'full_no_ai', 'full_ai_sample']);
    expect(report.notes.join('\n')).toContain('Handwritten set (4 messages');
    expect(report.notes.join('\n')).not.toContain('AI second opinion was not part');
  });

  it('needs the headline configuration', async () => {
    const base = await input();
    expect(() => buildReport({ ...base, configs: { rules_only: base.configs.rules_only } })).toThrow(/full_no_ai/);
  });

  it('scores the real sample statements and writes readable Markdown without message text', async () => {
    const statements: StatementRun[] = SAMPLE_STATEMENTS.map((s) => {
      const { txns } = parseStatementCsv(s.csv);
      return { id: s.id, txns: txns.length, anomalies: analyzeStatement(txns, 'en').anomalies, labels: loadStatementLabels(s.id)! };
    });
    const block = statementBlock(statements);
    expect(block.block).toMatchObject({ injected: 6, caught: 6 });
    expect(block.block!.falseFlagsPer100).toBeLessThanOrEqual(1);
    expect(block.typeMatched).toBeGreaterThanOrEqual(5);
    const full = await input({ statements });
    const report = EvalReportSchema.parse(buildReport(full));
    expect(report.statements).toEqual(block.block);
    const md = toMarkdown(report, full);
    for (const heading of ['# Evaluation report', '## Configurations', '## By language', '## Recall by scam category', '## Verdicts', '## Statements']) {
      expect(md).toContain(heading);
    }
    expect(md).toContain('| salaried |');
    expect(md).toContain('No warning signs found');
    expect(md).not.toContain('text of s1');
  });
});
