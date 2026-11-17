import type { Metrics, Verdict } from '@akshi/contracts';

export const VERDICTS: Verdict[] = ['scam', 'suspicious', 'no_signs'];

/** One evaluated message: the truth and what the engine said. */
export interface Outcome {
  scam: boolean;
  verdict: Verdict;
}

const round = (n: number, places = 4) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};
const ratio = (a: number, b: number) => (b === 0 ? 0 : round(a / b));

/**
 * Binary metrics. By default a message counts as flagged when the verdict is `scam` or `suspicious`
 * (SPEC_C_DATA.md §5); with `scamOnly`, only `scam` counts.
 */
export function metrics(outcomes: Outcome[], scamOnly = false): Metrics {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  for (const o of outcomes) {
    const flagged = scamOnly ? o.verdict === 'scam' : o.verdict !== 'no_signs';
    if (o.scam && flagged) tp++;
    else if (o.scam) fn++;
    else if (flagged) fp++;
    else tn++;
  }
  const precision = ratio(tp, tp + fp);
  const recall = ratio(tp, tp + fn);
  return {
    precision,
    recall,
    f1: precision + recall === 0 ? 0 : round((2 * precision * recall) / (precision + recall)),
    accuracy: ratio(tp + tn, outcomes.length),
    fpr: ratio(fp, fp + tn),
    support: outcomes.length,
  };
}

/** Share of genuine messages that were flagged (0 when there are none). */
export function falseAlarmRate(outcomes: Outcome[]): number {
  const genuine = outcomes.filter((o) => !o.scam);
  return ratio(genuine.filter((o) => o.verdict !== 'no_signs').length, genuine.length);
}

/** Share of scam messages that were flagged. */
export function recall(outcomes: Outcome[]): number {
  const scams = outcomes.filter((o) => o.scam);
  return ratio(scams.filter((o) => o.verdict !== 'no_signs').length, scams.length);
}

/**
 * 3 × 3 table in the shape the Proof page draws: rows are what the message really is, columns the verdict.
 * The data has only two truths, so the middle row (`suspicious`) is always zero: row 0 is scams, row 2 genuine.
 */
export function confusion(outcomes: Outcome[]): { labels: string[]; matrix: number[][] } {
  const matrix = VERDICTS.map(() => VERDICTS.map(() => 0));
  for (const o of outcomes) matrix[o.scam ? 0 : 2]![VERDICTS.indexOf(o.verdict)]!++;
  return { labels: [...VERDICTS], matrix };
}

/** Nearest-rank percentile, p in 0..1. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))]!;
}

export interface StatementLabel {
  txnIds: string[];
  type: string;
}

/** Compares the anomalies found in one statement with its labelled scenarios. */
export function scoreStatement(
  anomalies: { txnIds: string[]; type: string }[],
  labels: StatementLabel[],
): { injected: number; caught: number; typeMatched: number; falseFlags: number } {
  const overlaps = (a: string[], b: string[]) => a.some((id) => b.includes(id));
  let caught = 0;
  let typeMatched = 0;
  for (const label of labels) {
    const hits = anomalies.filter((a) => overlaps(a.txnIds, label.txnIds));
    if (hits.length > 0) caught++;
    if (hits.some((a) => a.type === label.type)) typeMatched++;
  }
  const falseFlags = anomalies.filter((a) => !labels.some((l) => overlaps(a.txnIds, l.txnIds))).length;
  return { injected: labels.length, caught, typeMatched, falseFlags };
}
