/**
 * Cross-module links (2026-11-22): connects the three checks Akshi does, so one scam shows up as
 * one story instead of three separate results.
 *
 * - A statement's payments are matched against the UPI IDs and phone numbers in your scam checks
 *   (messages, collect requests, QR codes), your blocklist and Akshi's bundled sample scam data.
 * - In the other direction, a checked scam's UPI IDs and numbers are matched against the
 *   statements you uploaded ("You have paid this UPI ID before").
 *
 * Evidence only: a link needs the same UPI ID or phone number on both sides, written the same way
 * after normalising (case for UPI IDs; the last 10 digits for Indian mobile numbers). Checks with
 * no warning signs are not evidence and are ignored.
 */
import type { BlockEntry, ScanRecord } from './db';
import { lookupIndicator, type AnalysisResult, type InputKind, type Txn } from './engine';

export type DetailType = 'upi' | 'phone';
export interface DetailRef {
  type: DetailType;
  /** normalised: a lower-case UPI ID, or +91 and ten digits */
  value: string;
}

export type LinkSource =
  | {
      kind: 'check';
      scanId: string;
      at: string;
      verdict: 'scam' | 'suspicious';
      risk: number;
      scanKind: InputKind;
    }
  | { kind: 'blocklist'; at: string }
  | { kind: 'indicator'; campaign?: string; reports: number };

export interface TxnLink {
  txn: Txn;
  detail: DetailRef;
  sources: LinkSource[];
  /** high: you paid someone your own checks or blocklist flagged; medium: the rest */
  level: 'high' | 'medium';
}

const VPA = /[a-z0-9._-]{2,256}@[a-z][a-z0-9]{1,63}/gi;
// a bare "91" prefix needs a separator, so a 12-digit bank reference (917654321098) is not a number
const MOBILE = /(?<!\d)(?:\+91[\s-]?|91[\s-]|0)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/g;

export const keyOf = (d: DetailRef) => `${d.type}:${d.value}`;

export function normalise(type: DetailType, raw: string): string | null {
  if (type === 'upi') {
    const v = raw.trim().toLowerCase();
    return /^[a-z0-9._-]{2,256}@[a-z][a-z0-9]{1,63}$/.test(v) ? v : null;
  }
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 10 && /^[6-9]/.test(digits.slice(-10)) ? `+91${digits.slice(-10)}` : null;
}

function uniq(details: DetailRef[]): DetailRef[] {
  const seen = new Set<string>();
  return details.filter((d) => !seen.has(keyOf(d)) && seen.add(keyOf(d)));
}

/** UPI IDs and phone numbers in a statement row (its UPI field, payee and description). */
export function txnDetails(txn: Txn): DetailRef[] {
  const out: DetailRef[] = [];
  const add = (type: DetailType, raw: string) => {
    const value = normalise(type, raw);
    if (value) out.push({ type, value });
  };
  if (txn.upiId) add('upi', txn.upiId);
  const text = `${txn.counterparty ?? ''} ${txn.description}`;
  for (const m of text.matchAll(VPA)) add('upi', m[0]);
  // a number inside a UPI ID (9876500001@ybl) is that UPI ID, not a separate phone detail
  for (const m of text.replace(VPA, ' ').matchAll(MOBILE)) add('phone', m[0]);
  return uniq(out);
}

/** UPI IDs and phone numbers a check found. */
export function resultDetails(result: Pick<AnalysisResult, 'entities'>): DetailRef[] {
  const out: DetailRef[] = [];
  for (const u of result.entities.upiIds) {
    const v = normalise('upi', u.raw);
    if (v) out.push({ type: 'upi', value: v });
  }
  for (const p of result.entities.phones) {
    const v = normalise('phone', p.e164 ?? p.raw);
    if (v) out.push({ type: 'phone', value: v });
  }
  return uniq(out);
}

/** Where each UPI ID or number was seen before: your scam checks and your blocklist. */
export function buildEvidence(
  checks: readonly ScanRecord[],
  blocked: readonly BlockEntry[],
): Map<string, LinkSource[]> {
  const index = new Map<string, LinkSource[]>();
  const push = (d: DetailRef, s: LinkSource) => {
    const k = keyOf(d);
    index.set(k, [...(index.get(k) ?? []), s]);
  };
  for (const c of checks) {
    if (c.verdict === 'no_signs') continue;
    for (const d of resultDetails(c.result))
      push(d, {
        kind: 'check',
        scanId: c.id,
        at: c.createdAt,
        verdict: c.verdict,
        risk: c.riskScore,
        scanKind: c.kind,
      });
  }
  for (const b of blocked) {
    if (b.type === 'domain') continue;
    const v = normalise(b.type, b.value);
    if (v) push({ type: b.type, value: v }, { kind: 'blocklist', at: b.addedAt });
  }
  return index;
}

function indicatorSource(d: DetailRef): LinkSource | null {
  const m = lookupIndicator(d.value);
  if (!m || m.source !== 'bundled' || m.type !== d.type) return null;
  return { kind: 'indicator', campaign: m.campaign, reports: m.reports };
}

/** A statement's payments to (or from) UPI IDs and numbers with scam evidence, most serious first. */
export function linkTransactions(
  txns: readonly Txn[],
  evidence: Map<string, LinkSource[]>,
): TxnLink[] {
  const links: TxnLink[] = [];
  for (const txn of txns) {
    for (const detail of txnDetails(txn)) {
      const sources = [...(evidence.get(keyOf(detail)) ?? [])];
      const ind = indicatorSource(detail);
      if (ind) sources.push(ind);
      if (!sources.length) continue;
      const own = sources.some((s) => s.kind !== 'indicator');
      links.push({
        txn,
        detail,
        sources,
        level: txn.direction === 'debit' && own ? 'high' : 'medium',
      });
    }
  }
  const rank = (l: TxnLink) => (l.level === 'high' ? 0 : 2) + (l.txn.direction === 'debit' ? 0 : 1);
  return links.sort((a, b) => rank(a) - rank(b) || b.txn.date.localeCompare(a.txn.date));
}

export interface PayeeLinks {
  detail: DetailRef;
  /** the payments to and from this UPI ID or number, oldest first */
  txns: Txn[];
  sources: LinkSource[];
  level: 'high' | 'medium';
  paidOut: number;
  paidIn: number;
}

/** One entry per UPI ID or number: its payments together, the evidence once, most serious first. */
export function groupLinks(links: readonly TxnLink[]): PayeeLinks[] {
  const groups = new Map<string, PayeeLinks>();
  for (const l of links) {
    const k = keyOf(l.detail);
    const g = groups.get(k) ?? {
      detail: l.detail,
      txns: [],
      sources: l.sources,
      level: 'medium' as const,
      paidOut: 0,
      paidIn: 0,
    };
    g.txns.push(l.txn);
    if (l.level === 'high') g.level = 'high';
    if (l.txn.direction === 'debit') g.paidOut += l.txn.amount;
    else g.paidIn += l.txn.amount;
    groups.set(k, g);
  }
  for (const g of groups.values()) g.txns.sort((a, b) => a.date.localeCompare(b.date));
  return [...groups.values()].sort(
    (a, b) => (a.level === b.level ? 0 : a.level === 'high' ? -1 : 1) || b.paidOut - a.paidOut,
  );
}

export interface PaidBefore {
  statementId: string;
  statementName: string;
  txn: Txn;
  detail: DetailRef;
}

/** Payments in your uploaded statements to (or from) the UPI IDs and numbers a check found. */
export function paymentsFor(
  result: Pick<AnalysisResult, 'entities'>,
  statements: readonly { id: string; name: string; analysis: { txns: Txn[] } }[],
): PaidBefore[] {
  const wanted = new Map(resultDetails(result).map((d) => [keyOf(d), d]));
  if (!wanted.size) return [];
  const out: PaidBefore[] = [];
  const seen = new Set<string>();
  for (const st of statements)
    for (const txn of st.analysis.txns)
      for (const d of txnDetails(txn)) {
        if (!wanted.has(keyOf(d))) continue;
        // the same statement uploaded twice shows each payment once
        const k = `${keyOf(d)}|${txn.date}|${txn.amount}|${txn.direction}`;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ statementId: st.id, statementName: st.name, txn, detail: d });
      }
  return out.sort((a, b) => b.txn.date.localeCompare(a.txn.date));
}
