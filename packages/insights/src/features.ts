import type { Txn } from '@akshi/contracts';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Milliseconds of the local wall-clock time written in the statement (read as UTC so no time zone applies). */
export function timeOf(txn: Txn): number {
  return Date.parse(txn.date.length <= 19 ? txn.date + 'Z' : txn.date);
}

export function hourOf(txn: Txn): number {
  return Number(txn.date.slice(11, 13)) + Number(txn.date.slice(14, 16)) / 60;
}

/** Who a payment goes to: the UPI ID when there is one, else the counterparty name. */
export function payeeKey(txn: Txn): string {
  return (txn.upiId || txn.counterparty || txn.description).trim().toLowerCase();
}

export const isRound = (amount: number): boolean => amount >= 1000 && amount % 1000 === 0;

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Linear-interpolated percentile, p in 0..1 (the same method numpy uses by default). */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}

export interface DebitInfo {
  txn: Txn;
  time: number;
  key: string;
  /** first debit to this payee in the statement */
  firstEver: boolean;
  /** the payee is paid again a week or more apart (rent, a supplier, a regular shop) */
  established: boolean;
  /**
   * New for the anomaly rules: first debit to this payee, and the payee is not one that is paid again a week or
   * more later (rent, a supplier, a regular shop). A statement starts mid-life, so without this every regular
   * payee would look new on its first row.
   */
  isNew: boolean;
  /** days since the previous debit to the same payee, capped at 90; 90 for a first debit */
  daysSinceLast: number;
  /** debits in the 60 minutes before this one */
  prevHourCount: number;
}

/** Debits in time order with the per-payee history each rule and the Isolation Forest need. */
export function debitInfo(txns: Txn[]): DebitInfo[] {
  const debits = txns
    .map((txn, order) => ({ txn, order, time: timeOf(txn) }))
    .filter((d) => d.txn.direction === 'debit' && Number.isFinite(d.time))
    .sort((a, b) => a.time - b.time || a.order - b.order);
  const first = new Map<string, number>();
  const last = new Map<string, number>();
  for (const d of debits) {
    const key = payeeKey(d.txn);
    if (!first.has(key)) first.set(key, d.time);
    last.set(key, d.time);
  }
  const seen = new Map<string, number>();
  const out: DebitInfo[] = [];
  let windowStart = 0;
  debits.forEach((d, i) => {
    const key = payeeKey(d.txn);
    const prev = seen.get(key);
    const firstEver = prev === undefined;
    const established = last.get(key)! - first.get(key)! >= 7 * DAY;
    while (windowStart < i && d.time - debits[windowStart]!.time > HOUR) windowStart++;
    const prevHourCount = i - windowStart;
    out.push({
      txn: d.txn,
      time: d.time,
      key,
      firstEver,
      established,
      isNew: firstEver && !established,
      daysSinceLast: firstEver ? 90 : Math.min(90, (d.time - prev) / DAY),
      prevHourCount: d.txn.hasTime ? prevHourCount : 0,
    });
    seen.set(key, d.time);
  });
  return out;
}

export const FOREST_FEATURES = ['amount', 'hour', 'hour', 'newPayee', 'daysSince', 'prevHour', 'round', 'upi'] as const;

/** Isolation Forest feature rows (SPEC_C_DATA.md §6.4). Hour columns are left out when the statement has no times. */
export function forestRows(debits: DebitInfo[], withTime: boolean): number[][] {
  return debits.map((d) => {
    const row = [Math.log10(Math.max(d.txn.amount, 0.01))];
    if (withTime) {
      const angle = (2 * Math.PI * hourOf(d.txn)) / 24;
      row.push(Math.sin(angle), Math.cos(angle));
    }
    row.push(d.firstEver ? 1 : 0, d.daysSinceLast, d.prevHourCount, isRound(d.txn.amount) ? 1 : 0, d.txn.channel === 'UPI' ? 1 : 0);
    return row;
  });
}
