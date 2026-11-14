// STUB — owned by Laptop C; replaced on feat/data
import type { L10n, Lang, ParsedStatement, StatementAnalysis, Txn } from '@akshi/contracts';
import { STATEMENT_ANALYSIS_FIXTURE } from '@akshi/contracts/fixtures';

const CANONICAL_HEADER = 'date,time,description,debit,credit,balance,channel,counterparty,upi_id';
const CHANNELS: Txn['channel'][] = ['UPI', 'IMPS', 'NEFT', 'RTGS', 'CARD', 'ATM', 'OTHER'];

function num(s: string | undefined): number {
  return Number((s ?? '').replace(/,/g, '').trim()) || 0;
}

function isoDate(date: string, time: string): string {
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date);
  const ymd = dmy ? `${dmy[3]}-${dmy[2]}-${dmy[1]}` : date;
  return `${ymd}T${time || '00:00'}:00`;
}

/** Naive canonical-format parser (SPEC_C §6.1). No quoting support; bank_a / bank_b → 'unknown'. */
export function parseStatementCsv(csv: string): ParsedStatement {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== '');
  const header = (lines[0] ?? '').toLowerCase().replace(/\s+/g, '');
  if (header !== CANONICAL_HEADER) {
    return {
      txns: [],
      errors: ['Only the canonical CSV format is supported by the stub'],
      format: 'unknown',
    };
  }
  const txns: Txn[] = [];
  const errors: string[] = [];
  lines.slice(1).forEach((line, i) => {
    const [
      date = '',
      time = '',
      description = '',
      debit,
      credit,
      balance,
      channel = '',
      counterparty = '',
      upiId = '',
    ] = line.split(',').map((c) => c.trim());
    const d = num(debit);
    const c = num(credit);
    if (!date || (!d && !c)) {
      errors.push(`Row ${i + 2}: missing date or amount`);
      return;
    }
    const ch = channel.toUpperCase() as Txn['channel'];
    const t: Txn = {
      id: `txn-${String(i + 1).padStart(3, '0')}`,
      date: isoDate(date, time),
      hasTime: time !== '',
      description,
      amount: d || c,
      direction: d ? 'debit' : 'credit',
      channel: CHANNELS.includes(ch) ? ch : 'OTHER',
      category: 'other',
    };
    if (balance) t.balance = num(balance);
    if (counterparty) t.counterparty = counterparty;
    if (upiId) t.upiId = upiId;
    txns.push(t);
  });
  return { txns, errors, format: 'canonical' };
}

/** Returns the statement-analysis fixture with the caller's transactions. */
export function analyzeStatement(txns: Txn[], _lang: Lang): StatementAnalysis {
  const ids = new Set(txns.map((t) => t.id));
  const fx = STATEMENT_ANALYSIS_FIXTURE;
  return {
    ...fx,
    txns,
    anomalies: fx.anomalies.filter((a) => a.txnIds.every((id) => ids.has(id))),
  };
}

function toCsv(txns: Txn[]): string {
  const rows = txns.map((t) => {
    const [date = '', time = ''] = t.date.split('T');
    return [
      date,
      time.slice(0, 5),
      t.description,
      t.direction === 'debit' ? t.amount.toFixed(2) : '',
      t.direction === 'credit' ? t.amount.toFixed(2) : '',
      t.balance?.toFixed(2) ?? '',
      t.channel,
      t.counterparty ?? '',
      t.upiId ?? '',
    ].join(',');
  });
  return [CANONICAL_HEADER, ...rows].join('\n') + '\n';
}

export const SAMPLE_STATEMENTS: { id: string; title: L10n; persona: string; csv: string }[] = [
  {
    id: 'salaried',
    title: { en: 'Salaried professional (sample)', hi: 'नौकरीपेशा व्यक्ति (नमूना)', te: 'ఉద్యోగి (నమూనా)' },
    persona: 'Salaried professional, one month of UPI, card and bill payments',
    csv: toCsv(STATEMENT_ANALYSIS_FIXTURE.txns),
  },
];
