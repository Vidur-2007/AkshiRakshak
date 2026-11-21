/**
 * The profile behind a flagged payment (2026-11-22): this payment next to your own usual ones,
 * for the "This payment vs your usual" card on the Transactions page.
 *
 * Everything comes from the statement itself: the baseline the analysis already computed (your
 * median payment, usual hours, frequent payees) and the earlier rows of the same statement. It
 * describes an unusual pattern, never proof of fraud, and the card says so.
 */
import type { Anomaly, StatementAnalysis, Txn } from './engine';

export interface TxnProfile {
  /** this payment, or the total of the payments in the pattern */
  amount: number;
  /** payments in the pattern (1 for a single payment) */
  count: number;
  /** your median payment */
  typical: number;
  /** amount ÷ typical, one decimal; null when there is no usual payment to compare with */
  times: number | null;
  /** payments to the same recipient before this pattern began (0 = first time) */
  paidBefore: number;
  /** a recipient you pay regularly: three or more other payments in this statement (the analysis's own rule) */
  regular: boolean;
  /** hour of the main payment, when the statement has times */
  hour: number | null;
  /** its clock time, "01:34" */
  clock: string | null;
  /** outside your usual hours; null when either is unknown */
  unusualHour: boolean | null;
  /** 0–100, from the anomaly's own score */
  score: number;
}

const payeeKey = (t: Txn) => (t.upiId || t.counterparty || t.description).trim().toLowerCase();
const hourOf = (t: Txn) => Number(t.date.slice(11, 13));

/** Inside [from, to] hours, also when the window runs past midnight (22 → 2). */
export function inHours(hour: number, [from, to]: readonly [number, number]): boolean {
  return from <= to ? hour >= from && hour <= to : hour >= from || hour <= to;
}

export function profileOf(
  anomaly: Pick<Anomaly, 'txnIds' | 'score'>,
  analysis: Pick<StatementAnalysis, 'txns' | 'baseline'>,
): TxnProfile | null {
  const related = analysis.txns.filter(
    (t) => anomaly.txnIds.includes(t.id) && t.direction === 'debit',
  );
  if (!related.length) return null;
  // the main payment: the largest; ties go to the earliest
  const main = [...related].sort((a, b) => b.amount - a.amount || a.date.localeCompare(b.date))[0]!;
  const amount = related.reduce((s, t) => s + t.amount, 0);
  const { medianDebit: typical, usualHours } = analysis.baseline;
  const key = payeeKey(main);
  // the recipient's other payments: the pattern itself does not make them a known or regular payee
  const others = analysis.txns.filter(
    (t) => t.direction === 'debit' && payeeKey(t) === key && !anomaly.txnIds.includes(t.id),
  );
  const start = related.reduce((d, t) => (t.date < d ? t.date : d), related[0]!.date);
  const paidBefore = others.filter((t) => t.date < start).length;
  const hour = main.hasTime ? hourOf(main) : null;
  return {
    amount,
    count: related.length,
    typical,
    times: typical > 0 ? Math.round((amount / typical) * 10) / 10 : null,
    paidBefore,
    regular: others.length >= 3,
    hour,
    clock: main.hasTime ? main.date.slice(11, 16) : null,
    unusualHour: hour === null || !usualHours ? null : !inHours(hour, usualHours),
    score: Math.round(Math.max(0, Math.min(1, anomaly.score)) * 100),
  };
}
