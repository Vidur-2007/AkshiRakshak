import type { ParsedStatement, Txn } from '@akshi/contracts';
import { categorise } from './categorise';

type Format = ParsedStatement['format'];

const HEADERS: Record<Exclude<Format, 'unknown'>, string> = {
  canonical: 'date,time,description,debit,credit,balance,channel,counterparty,upi_id',
  bank_a: 'txndate,valuedate,description,refno./chequeno.,debit,credit,balance',
  bank_b: 'date,narration,amount,dr/cr,balance',
};
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MAX_ERRORS = 50;

/** Splits CSV text into rows of cells. Handles quoted cells, doubled quotes and newlines inside quotes. */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export function detectFormat(header: string[]): Format {
  const key = header.map((h) => h.toLowerCase().replace(/\s+/g, '')).join(',');
  for (const [format, expected] of Object.entries(HEADERS)) {
    if (key === expected) return format as Format;
  }
  return 'unknown';
}

/** "1,00,000.00", "₹ 250", "Rs. 1,250.50", "(500.00)" → number; null when it is not an amount. */
export function parseAmount(raw: string | undefined): number | null {
  let s = (raw ?? '').trim();
  if (s === '' || s === '-') return null;
  s = s.replace(/₹|rs\.?|inr/gi, '').replace(/[,\s]/g, '');
  const negative = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[()+-]/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return negative ? -n : n;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY, DD-Mon-YYYY and DD Mon YYYY. Returns YYYY-MM-DD. */
export function parseDate(raw: string | undefined): string | null {
  const s = (raw ?? '').trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (y < 100) y += 2000;
  } else if ((match = /^(\d{1,2})[\s/-]([A-Za-z]{3})[A-Za-z]*[\s/-](\d{2}|\d{4})$/.exec(s))) {
    d = Number(match[1]);
    m = MONTHS.indexOf(match[2]!.toLowerCase()) + 1;
    y = Number(match[3]);
    if (y < 100) y += 2000;
  } else return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null; // 31 February and the like
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** "9:05", "09:05", "09:05:33", "9:05 PM" → "HH:MM"; null when empty or not a time. */
export function parseTime(raw: string | undefined): string | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/.exec((raw ?? '').trim());
  if (!match) return null;
  let h = Number(match[1]);
  const min = Number(match[2]);
  const ampm = match[3]?.toLowerCase();
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}

export function channelOf(description: string, hint?: string): Txn['channel'] {
  const h = (hint ?? '').trim().toUpperCase();
  if (['UPI', 'IMPS', 'NEFT', 'RTGS', 'CARD', 'ATM', 'OTHER'].includes(h)) return h as Txn['channel'];
  const d = description.toUpperCase();
  if (/^UPI\b|\bUPI[/-]/.test(d)) return 'UPI';
  if (/\bIMPS\b/.test(d)) return 'IMPS';
  if (/\bNEFT\b/.test(d)) return 'NEFT';
  if (/\bRTGS\b/.test(d)) return 'RTGS';
  if (/\bATM\b|CASH WDL|CASH WITHDRAWAL/.test(d)) return 'ATM';
  if (/\bPOS\b|\bCARD\b|\bECOM\b/.test(d)) return 'CARD';
  return 'OTHER';
}

const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s.&-])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());

/**
 * Reads a UPI narration such as "UPI/DR/412345678901/RAVI K/YESB/ravik123@ybl/Payment".
 * Returns nothing for narrations that are not UPI.
 */
export function parseUpiNarration(description: string): {
  direction?: 'debit' | 'credit';
  counterparty?: string;
  upiId?: string;
} {
  const d = description.trim();
  if (!/^UPI[/-]/i.test(d)) return {};
  const parts = d.split(d[3] === '/' ? '/' : '-').map((p) => p.trim()).filter(Boolean);
  const out: ReturnType<typeof parseUpiNarration> = {};
  for (const part of parts.slice(1)) {
    const up = part.toUpperCase();
    if (!out.direction && (up === 'DR' || up === 'CR')) out.direction = up === 'DR' ? 'debit' : 'credit';
    else if (!out.upiId && /^[\w.-]+@[A-Za-z]{2,}$/.test(part)) out.upiId = part.toLowerCase();
    else if (!out.counterparty && !/^\d+$/.test(part) && !/^(P2A|P2M|P2P|P2V)$/i.test(part)) {
      out.counterparty = part === up ? titleCase(part) : part;
    }
  }
  return out;
}

/** Parses a bank statement CSV. Never throws: unreadable rows are listed in `errors` as "Row N: reason". */
export function parseStatementCsv(csv: string): ParsedStatement {
  const errors: string[] = [];
  const txns: Txn[] = [];
  let rows: string[][];
  try {
    rows = parseCsvRows(String(csv ?? '')).filter((r) => r.some((c) => c.trim() !== ''));
  } catch {
    return { txns, errors: ['The file could not be read as CSV'], format: 'unknown' };
  }
  if (rows.length === 0) return { txns, errors: ['The file is empty'], format: 'unknown' };
  const format = detectFormat(rows[0]!);
  if (format === 'unknown') {
    return {
      txns,
      errors: ['Unrecognised column headers. Use the sample format: ' + HEADERS.canonical],
      format,
    };
  }
  const fail = (row: number, message: string) => {
    if (errors.length < MAX_ERRORS) errors.push(`Row ${row}: ${message}`);
    else if (errors.length === MAX_ERRORS) errors.push('More rows could not be read; only the first 50 problems are listed');
  };

  rows.slice(1).forEach((cells, i) => {
    const rowNo = i + 2; // 1-based, counting the header
    const c = cells.map((x) => x.trim());
    let dateRaw: string | undefined;
    let timeRaw: string | undefined;
    let description: string;
    let debit: number | null = null;
    let credit: number | null = null;
    let balanceRaw: string | undefined;
    let channelHint: string | undefined;
    let counterparty = '';
    let upiId = '';

    if (format === 'canonical') {
      [dateRaw, timeRaw, description = '', , , balanceRaw, channelHint, counterparty = '', upiId = ''] = c;
      debit = parseAmount(c[3]);
      credit = parseAmount(c[4]);
      if ((c[3] ?? '') !== '' && debit === null) return fail(rowNo, 'debit is not a number');
      if ((c[4] ?? '') !== '' && credit === null) return fail(rowNo, 'credit is not a number');
    } else if (format === 'bank_a') {
      [dateRaw, , description = '', , , , balanceRaw] = c;
      debit = parseAmount(c[4]);
      credit = parseAmount(c[5]);
      if ((c[4] ?? '') !== '' && debit === null) return fail(rowNo, 'debit is not a number');
      if ((c[5] ?? '') !== '' && credit === null) return fail(rowNo, 'credit is not a number');
    } else {
      [dateRaw, description = '', , , balanceRaw] = c;
      const amount = parseAmount(c[2]);
      const drcr = (c[3] ?? '').toLowerCase().replace(/\./g, '');
      if (amount === null) return fail(rowNo, 'amount is not a number');
      if (drcr === 'dr' || drcr === 'debit') debit = Math.abs(amount);
      else if (drcr === 'cr' || drcr === 'credit') credit = Math.abs(amount);
      else return fail(rowNo, 'Dr/Cr must be Dr or Cr');
    }

    const date = parseDate(dateRaw);
    if (!date) return fail(rowNo, 'date is missing or not a date');
    const time = format === 'canonical' ? parseTime(timeRaw) : null;
    if (format === 'canonical' && (timeRaw ?? '') !== '' && !time) return fail(rowNo, 'time is not HH:MM');
    const hasDebit = debit !== null && debit !== 0;
    const hasCredit = credit !== null && credit !== 0;
    if (!hasDebit && !hasCredit) return fail(rowNo, 'no debit or credit amount');
    if (hasDebit && hasCredit) return fail(rowNo, 'both debit and credit are filled');

    const upi = parseUpiNarration(description);
    const direction: Txn['direction'] = hasDebit ? 'debit' : 'credit';
    const channel = channelOf(description, channelHint);
    const party = counterparty || upi.counterparty || description;
    const id = upiId.toLowerCase() || upi.upiId || '';
    const txn: Txn = {
      id: `txn-${String(i + 1).padStart(3, '0')}`,
      date: `${date}T${time ?? '00:00'}:00`,
      hasTime: time !== null,
      description,
      amount: Math.abs((hasDebit ? debit : credit)!),
      direction,
      channel,
      category: 'other',
    };
    const balance = parseAmount(balanceRaw);
    if (balance !== null) txn.balance = balance;
    if (party) txn.counterparty = party;
    if (id) txn.upiId = id;
    txn.category = categorise(txn);
    txns.push(txn);
  });
  return { txns, errors, format };
}
