import { describe, expect, it } from 'vitest';
import { EntityGraphSchema, ParsedStatementSchema, StatementAnalysisSchema } from '@akshi/contracts';
import type { AnalysisResult, Anomaly, Lang, Txn } from '@akshi/contracts';
import { INDICATORS } from '@akshi/content';
import { analyzeStatement, buildEntityGraph, parseStatementCsv, SAMPLE_STATEMENTS } from '../src/index';
import { statementRisk } from '../src/analyze';
import { categorise } from '../src/categorise';
import { detectFormat, parseAmount, parseCsvRows, parseDate, parseTime, parseUpiNarration } from '../src/csv';
import { debitInfo, forestRows, median, percentile } from '../src/features';
import { normaliseEntity } from '../src/graph';
import { averagePathLength, isolationForestScores, mulberry32 } from '../src/iforest';
import { money } from '../src/strings';
import reference from './iforest-reference.json';

// this package compiles without DOM or Node typings; both runtimes provide console
declare const console: { info(message: string): void };

const HEADER = 'date,time,description,debit,credit,balance,channel,counterparty,upi_id';
type Row = [date: string, time: string, payee: string, debit: number | '', credit?: number | '', upi?: string];
const line = ([d, t, p, db, cr = '', upi = '']: Row) =>
  [d, t, 'UPI/' + (db === '' ? 'CR' : 'DR') + '/' + p + '/Payment', db, cr, '', 'UPI', p, upi].join(',');
const csvOf = (rows: Row[]) => [HEADER, ...rows.map(line)].join('\n');
const two = (n: number) => String(n).padStart(2, '0');
const stamp = (r: Row) => r[0] + r[1];
const byTime = (rows: Row[]) => [...rows].sort((a, b) => stamp(a).localeCompare(stamp(b)));

/** 40 ordinary days: a ₹300 lunch and a ₹150 ride every day, a ₹900 grocery run every fifth day. */
function ordinary(): Row[] {
  const rows: Row[] = [];
  for (let day = 1; day <= 40; day++) {
    const date = day <= 31 ? '2026-08-' + two(day) : '2026-09-' + two(day - 31);
    rows.push([date, '13:10', 'Swiggy', 300], [date, '18:30', 'Uber', 150]);
    if (day % 5 === 0) rows.push([date, '19:45', 'BigBasket', 900]);
  }
  return rows;
}
const run = (extra: Row[], lang: Lang = 'en') => {
  const parsed = parseStatementCsv(csvOf(byTime([...ordinary(), ...extra])));
  expect(parsed.errors).toEqual([]);
  return StatementAnalysisSchema.parse(analyzeStatement(parsed.txns, lang));
};
const types = (a: { anomalies: Anomaly[] }) => a.anomalies.map((x) => x.type);
/** Rule anomalies only: the Isolation Forest may separately flag a one-off payment that no rule covers. */
const rules = (a: { anomalies: Anomaly[] }) => types(a).filter((t) => t !== 'isolation_outlier');

describe('CSV parsing', () => {
  it('reads quoted cells, doubled quotes, CRLF and a byte-order mark', () => {
    expect(parseCsvRows('﻿a,"b,1","say ""hi"""\r\n1,2,3\n')).toEqual([
      ['a', 'b,1', 'say "hi"'],
      ['1', '2', '3'],
    ]);
  });

  it('detects the three formats whatever the case and spacing of the header', () => {
    expect(detectFormat(HEADER.split(','))).toBe('canonical');
    expect(
      detectFormat(['Txn Date', 'Value Date', 'Description', 'Ref No./Cheque No.', 'Debit', 'Credit', 'Balance']),
    ).toBe('bank_a');
    expect(detectFormat([' DATE ', 'narration', 'Amount', 'Dr / Cr', 'balance'])).toBe('bank_b');
    expect(detectFormat(['date', 'description', 'amount'])).toBe('unknown');
  });

  it('parses Indian amounts, dates and times', () => {
    expect(parseAmount('1,00,000.00')).toBe(100000);
    expect(parseAmount('₹ 2,499.50')).toBe(2499.5);
    expect(parseAmount('Rs. 250')).toBe(250);
    expect(parseAmount('(500.00)')).toBe(-500);
    expect([parseAmount(''), parseAmount('abc'), parseAmount('12a')]).toEqual([null, null, null]);
    expect(parseDate('2026-08-01')).toBe('2026-08-01');
    expect(parseDate('01/08/2026')).toBe('2026-08-01');
    expect(parseDate('1-8-26')).toBe('2026-08-01');
    expect(parseDate('01-Aug-2026')).toBe('2026-08-01');
    expect(parseDate('01 August 2026')).toBe('2026-08-01');
    expect([parseDate('31/02/2026'), parseDate('2026-13-01'), parseDate('soon'), parseDate('')]).toEqual([
      null,
      null,
      null,
      null,
    ]);
    expect([parseTime('9:05'), parseTime('09:05:33'), parseTime('9:05 PM'), parseTime('12:10 am')]).toEqual([
      '09:05',
      '09:05',
      '21:05',
      '00:10',
    ]);
    expect([parseTime(''), parseTime('25:00'), parseTime('noon')]).toEqual([null, null, null]);
  });

  it('reads direction, counterparty and UPI ID from a UPI narration', () => {
    expect(parseUpiNarration('UPI/DR/412345678901/RAVI K/YESB/ravik123@ybl/Payment')).toEqual({
      direction: 'debit',
      counterparty: 'Ravi K',
      upiId: 'ravik123@ybl',
    });
    expect(
      parseUpiNarration('UPI/CR/012345678901/SUNITA DEVI/OKSB/sunita.devi.demo@oksbi/Allowance').direction,
    ).toBe('credit');
    expect(parseUpiNarration('UPI-SWIGGY-swiggy.demo@icici-Food')).toEqual({
      counterparty: 'Swiggy',
      upiId: 'swiggy.demo@icici',
    });
    expect(parseUpiNarration('NEFT CR SALARY ACME')).toEqual({});
  });

  it('parses the canonical format', () => {
    const csv =
      HEADER +
      '\n2026-08-01,09:05,UPI/DR/012345678901/RAVI K/YESB/ravik123@ybl/Rent,"22,000.00",,"1,05,000.00",UPI,,' +
      '\n01/08/2026,,NEFT CR SALARY ACME,,85000,190000,NEFT,Acme,\n';
    const p = ParsedStatementSchema.parse(parseStatementCsv(csv));
    expect(p.format).toBe('canonical');
    expect(p.errors).toEqual([]);
    expect(p.txns[0]).toEqual({
      id: 'txn-001',
      date: '2026-08-01T09:05:00',
      hasTime: true,
      description: 'UPI/DR/012345678901/RAVI K/YESB/ravik123@ybl/Rent',
      amount: 22000,
      direction: 'debit',
      balance: 105000,
      channel: 'UPI',
      counterparty: 'Ravi K',
      upiId: 'ravik123@ybl',
      category: 'rent',
    });
    expect(p.txns[1]).toMatchObject({
      id: 'txn-002',
      date: '2026-08-01T00:00:00',
      hasTime: false,
      direction: 'credit',
      amount: 85000,
      channel: 'NEFT',
      category: 'salary',
    });
  });

  it('parses bank_a (no time) and bank_b (one amount column with Dr/Cr)', () => {
    const a = parseStatementCsv(
      'Txn Date,Value Date,Description,Ref No./Cheque No.,Debit,Credit,Balance\n' +
        '01/08/2026,01/08/2026,UPI/DR/012345678901/SWIGGY/Food,123,"1,250.00",,"98,750.00"\n' +
        '02-Aug-2026,02-Aug-2026,ATM WDL CASH,,2000,,96750\n',
    );
    expect(a.format).toBe('bank_a');
    expect(a.errors).toEqual([]);
    expect(a.txns.map((t) => [t.hasTime, t.amount, t.channel, t.category])).toEqual([
      [false, 1250, 'UPI', 'food'],
      [false, 2000, 'ATM', 'cash'],
    ]);
    const b = parseStatementCsv(
      'Date,Narration,Amount,Dr/Cr,Balance\n03/08/2026,IMPS to Priya,"5,000.00",Dr,91750\n04/08/2026,NEFT SALARY ACME,85000,CR,176750\n',
    );
    expect(b.format).toBe('bank_b');
    expect(b.txns.map((t) => [t.direction, t.amount, t.channel])).toEqual([
      ['debit', 5000, 'IMPS'],
      ['credit', 85000, 'NEFT'],
    ]);
  });

  it('lists bad rows with their row number and keeps the good ones', () => {
    const p = parseStatementCsv(
      [
        HEADER,
        '2026-08-01,09:05,ok,100,,,UPI,A,',
        'not-a-date,09:05,x,100,,,UPI,A,',
        '2026-08-02,25:99,x,100,,,UPI,A,',
        '2026-08-03,09:05,x,abc,,,UPI,A,',
        '2026-08-04,09:05,x,,,,UPI,A,',
        '2026-08-05,09:05,x,5,5,,UPI,A,',
        '2026-08-06,10:00,ok,,50,,UPI,B,',
      ].join('\n'),
    );
    expect(p.txns.map((t) => t.id)).toEqual(['txn-001', 'txn-007']);
    expect(p.errors).toEqual([
      'Row 3: date is missing or not a date',
      'Row 4: time is not HH:MM',
      'Row 5: debit is not a number',
      'Row 6: no debit or credit amount',
      'Row 7: both debit and credit are filled',
    ]);
    const b = parseStatementCsv('Date,Narration,Amount,Dr/Cr,Balance\n03/08/2026,x,100,maybe,1\n');
    expect(b.errors).toEqual(['Row 2: Dr/Cr must be Dr or Cr']);
  });

  it('never throws: empty, unknown and hostile input give errors', () => {
    const inputs = ['', '\n\n', 'date,description,amount\n2026-01-01,foo,abc\n', '"unclosed', '\u0000\u0001', 'a'.repeat(5000)];
    for (const input of inputs) {
      const p = ParsedStatementSchema.parse(parseStatementCsv(input));
      expect(p.txns).toEqual([]);
      expect(p.format).toBe('unknown');
      expect(p.errors.length).toBeGreaterThan(0);
    }
    expect(parseStatementCsv(undefined as unknown as string).txns).toEqual([]);
    const many = parseStatementCsv(HEADER + '\n' + 'bad,,x,1,,,UPI,A,\n'.repeat(200));
    expect(many.errors.length).toBe(51);
  });
});

describe('categoriser', () => {
  const cat = (description: string, channel: Txn['channel'] = 'UPI', direction: Txn['direction'] = 'debit') =>
    categorise({ description, channel, direction });

  it('maps merchants and keywords to categories', () => {
    expect([cat('UPI/DR/SWIGGY'), cat('Zomato order')]).toEqual(['food', 'food']);
    expect([cat('BIGBASKET'), cat('Blinkit'), cat('ZEPTO'), cat('DMart')]).toEqual(Array(4).fill('groceries'));
    expect([cat('AMAZON'), cat('Flipkart'), cat('MYNTRA')]).toEqual(Array(3).fill('shopping'));
    expect([cat('UBER'), cat('OLA'), cat('Rapido'), cat('IRCTC'), cat('Metro Rail')]).toEqual(Array(5).fill('transport'));
    expect([cat('Electricity Board'), cat('JIO recharge'), cat('Airtel broadband'), cat('Gas bill')]).toEqual(
      Array(4).fill('bills'),
    );
    expect([cat('House rent'), cat('School fees'), cat('Apollo Pharmacy'), cat('NETFLIX'), cat('BookMyShow')]).toEqual([
      'rent',
      'education',
      'health',
      'entertainment',
      'entertainment',
    ]);
    expect([cat('ATM WDL', 'ATM'), cat('SIP GROWW MUTUAL FUND', 'OTHER'), cat('HOME LOAN EMI', 'OTHER')]).toEqual([
      'cash',
      'investment',
      'emi',
    ]);
    expect(cat('NEFT CR SALARY ACME', 'NEFT', 'credit')).toBe('salary');
  });

  it('treats unmatched UPI payments as transfers and everything else as other', () => {
    expect(cat('UPI/DR/RAVI K/Payment')).toBe('transfers');
    expect(cat('POS XYZ STORE', 'CARD')).toBe('other');
    expect(cat('Olampics')).toBe('transfers'); // "ola" only matches as a whole word
  });
});

describe('baseline and helpers', () => {
  it('median, percentile and money formatting', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(percentile([1, 2, 3, 4, 5], 0.9)).toBeCloseTo(4.6);
    expect([money(148000), money(999), money(1234.5), money(100000)]).toEqual([
      '₹1,48,000',
      '₹999',
      '₹1,234.50',
      '₹1,00,000',
    ]);
  });

  it('computes median, p90, usual hours and frequent payees over debits', () => {
    const a = run([]);
    expect(a.baseline.medianDebit).toBe(300);
    expect(a.baseline.usualHours).toEqual([13, 19]);
    expect(a.baseline.frequentPayees.slice(0, 3)).toEqual(['Swiggy', 'Uber', 'BigBasket']);
    expect(a.anomalies).toEqual([]);
    expect(a.riskScore).toBe(0);
    expect(a.narrative).toContain('Nothing unusual');
    expect(a.summary.byCategory.map((c) => c.category)).toEqual(['food', 'groceries', 'transport']);
    expect(a.summary.byMonth.map((m) => m.month)).toEqual(['2026-08', '2026-09']);
    expect(a.summary.totalOut).toBe(40 * 450 + 8 * 900);
  });

  it('leaves usual hours null when the statement has no times', () => {
    const rows = Array.from({ length: 30 }, (_, i) => two(i + 1) + '/08/2026,UPI/DR/SWIGGY,300,Dr,1');
    const p = parseStatementCsv('Date,Narration,Amount,Dr/Cr,Balance\n' + rows.join('\n'));
    const a = StatementAnalysisSchema.parse(analyzeStatement(p.txns, 'en'));
    expect(a.baseline.usualHours).toBeNull();
    expect(a.anomalies).toEqual([]);
  });
});

describe('anomaly rules', () => {
  it('large_new_payee: first payment of at least max(5 × median, ₹5,000); high from 10 × median', () => {
    const a = run([['2026-08-20', '15:00', 'Vikram Enterprises', 48000]]);
    expect(a.anomalies).toHaveLength(1);
    expect(a.anomalies[0]).toMatchObject({
      type: 'large_new_payee',
      severity: 'high',
      title: 'Large payment to someone new',
    });
    expect(a.anomalies[0]!.explanation).toContain('₹48,000');
    expect(a.anomalies[0]!.features[0]).toEqual({ name: 'Amount', value: '₹48,000', baseline: 'usual ₹300' });
    expect(a.riskScore).toBe(60);
    expect(rules(run([['2026-08-20', '15:00', 'New Shop', 4999]]))).toEqual([]); // under ₹5,000
  });

  it('does not treat a regular payee as new on its first row', () => {
    expect(
      types(run([['2026-08-02', '10:30', 'R Sharma', 22000], ['2026-09-02', '10:30', 'R Sharma', 22000]])),
    ).toEqual([]);
  });

  it('burst_small_debits: three small payments to a new payee within 30 minutes', () => {
    const burst: Row[] = [10, 13, 17, 22].map((m) => ['2026-08-20', '21:' + m, 'Task Payout HR', 499, '', 'task.payout.hr@ybl']);
    const a = run(burst);
    expect(a.anomalies).toHaveLength(1);
    expect(a.anomalies[0]).toMatchObject({ type: 'burst_small_debits', severity: 'high' });
    expect(a.anomalies[0]!.txnIds).toHaveLength(4);
    expect(rules(run(burst.slice(0, 2)))).toEqual(['duplicate']); // two identical payments are a possible double charge, not a burst
    // spread over two hours: not a burst
    expect(
      rules(run([['2026-08-20', '10:00', 'T', 499], ['2026-08-20', '11:00', 'T', 499], ['2026-08-20', '12:00', 'T', 499]])),
    ).toEqual([]);
  });

  it('burst_small_debits: five payments of any size within 10 minutes', () => {
    const five: Row[] = [0, 2, 4, 6, 8].map((m) => ['2026-08-20', '15:0' + m, 'Swiggy', 300]);
    const a = run(five);
    expect(a.anomalies[0]).toMatchObject({ type: 'burst_small_debits', severity: 'high' });
    expect(a.anomalies[0]!.txnIds).toHaveLength(5);
  });

  it('odd_hour: a payment between midnight and 5 am of at least twice the median', () => {
    const a = run([['2026-08-20', '02:47', 'Swiggy', 900]]);
    expect(a.anomalies).toHaveLength(1);
    expect(a.anomalies[0]).toMatchObject({ type: 'odd_hour', severity: 'medium' });
    expect(a.anomalies[0]!.explanation).toContain('02:47');
    expect(types(run([['2026-08-20', '02:47', 'Swiggy', 400]]))).toEqual([]); // small
    expect(run([['2026-08-20', '02:47', 'Night Stranger', 900]]).anomalies[0]).toMatchObject({
      type: 'odd_hour',
      severity: 'high',
    });
  });

  it('duplicate: the same amount to the same payee within 10 minutes', () => {
    const later: Row = ['2026-08-29', '20:15', 'Myntra', 1299];
    const a = run([['2026-08-21', '20:14', 'Myntra', 1299], ['2026-08-21', '20:15', 'Myntra', 1299], later]);
    expect(a.anomalies).toHaveLength(1);
    expect(a.anomalies[0]).toMatchObject({ type: 'duplicate', severity: 'low' });
    expect(a.riskScore).toBe(43);
    expect(rules(run([['2026-08-21', '20:14', 'Myntra', 1299], ['2026-08-21', '20:40', 'Myntra', 1299], later]))).toEqual([]);
  });

  it('credit_then_return: money from a stranger, then about the same amount to someone new within 48 hours', () => {
    const credit: Row = ['2026-08-20', '13:12', 'Deepak M', '', 5000];
    const a = run([credit, ['2026-08-20', '15:48', 'D Mehta', 4900]]);
    expect(a.anomalies).toHaveLength(1);
    expect(a.anomalies[0]).toMatchObject({ type: 'credit_then_return', severity: 'high' });
    expect(a.anomalies[0]!.txnIds).toHaveLength(2);
    // three days later, or a clearly different amount: not matched
    expect(rules(run([credit, ['2026-08-24', '15:48', 'D Mehta', 4900]]))).toEqual([]);
    expect(rules(run([credit, ['2026-08-20', '15:48', 'D Mehta', 3000]]))).toEqual([]);
    // a credit followed by an ordinary payment to a regular payee is not a return
    expect(rules(run([['2026-08-20', '12:00', 'Friend', '', 900], ['2026-08-20', '21:00', 'Swiggy', 900]]))).toEqual([]);
  });

  it('round_amount_new_payee: a round ₹10,000 or more to a new payee, when it is not already a large payment', () => {
    const rows: Row[] = [];
    for (let d = 1; d <= 28; d++) rows.push(['2026-08-' + two(d), '11:00', 'Wholesale Mart', 6000 + d * 10]);
    rows.push(['2026-08-29', '11:30', 'Quick Finance Agent', 20000]);
    const a = analyzeStatement(parseStatementCsv(csvOf(rows)).txns, 'en');
    expect(a.anomalies).toHaveLength(1);
    expect(a.anomalies[0]).toMatchObject({ type: 'round_amount_new_payee', severity: 'medium' });
  });

  it('velocity: three or more payments in an hour adding up to four usual days', () => {
    const a = run([
      ['2026-08-20', '16:00', 'Swiggy', 700],
      ['2026-08-20', '16:20', 'Uber', 700],
      ['2026-08-20', '16:40', 'BigBasket', 900],
    ]);
    expect(types(a)).toEqual(['velocity']);
    expect(a.anomalies[0]!.txnIds).toHaveLength(3);
    expect(a.anomalies[0]!.severity).toBe('medium');
  });

  it('gives one card per payment and orders cards by severity', () => {
    // large, round, at night and to someone new: one high card, not four
    const a = run([
      ['2026-08-20', '02:47', 'Vikram Enterprises', 48000],
      ['2026-08-21', '20:14', 'Myntra', 1299],
      ['2026-08-21', '20:15', 'Myntra', 1299],
      ['2026-08-30', '20:15', 'Myntra', 1299],
    ]);
    expect(types(a)).toEqual(['large_new_payee', 'duplicate']);
    expect(a.anomalies.map((x) => x.id)).toEqual(['anom-01', 'anom-02']);
    expect(a.riskScore).toBe(63);
    expect(a.narrative).toContain('2 things stand out');
    expect(a.narrative).toContain('₹48,000');
  });

  it('risk score: 0 with nothing, else 40 + 20 per high + 10 per medium + 3 per low, capped at 100', () => {
    const s = (...xs: Anomaly['severity'][]) => statementRisk(xs.map((severity) => ({ severity })));
    expect([s(), s('low'), s('medium'), s('high'), s('high', 'medium', 'low'), s('high', 'high', 'high', 'high')]).toEqual([
      0, 43, 50, 60, 73, 100,
    ]);
  });

  it('writes titles, explanations and the narrative in all four languages', () => {
    const extra: Row[] = [['2026-08-20', '15:00', 'Vikram Enterprises', 48000]];
    const out = (['en', 'hi', 'te', 'bn'] as const).map((lang) => run(extra, lang));
    expect(new Set(out.map((a) => a.anomalies[0]!.title)).size).toBe(4);
    expect(new Set(out.map((a) => a.narrative)).size).toBe(4);
    expect(out[1]!.anomalies[0]!.title).toMatch(/[ऀ-ॿ]/);
    expect(out[2]!.anomalies[0]!.explanation).toMatch(/[ఀ-౿]/);
    expect(out[3]!.narrative).toMatch(/[ঀ-৿]/);
    out.forEach((a) => {
      expect(a.anomalies[0]!.explanation).toContain('₹48,000');
      expect(a.anomalies[0]!.explanation).not.toMatch(/[{}]/);
      expect(a.narrative).not.toMatch(/[{}]/);
    });
  });

  it('copes with nothing, one row, and credits only', () => {
    expect(StatementAnalysisSchema.parse(analyzeStatement([], 'en'))).toMatchObject({ anomalies: [], riskScore: 0 });
    const one = parseStatementCsv(csvOf([['2026-08-01', '10:00', 'Swiggy', 300]])).txns;
    expect(analyzeStatement(one, 'en').anomalies).toEqual([]);
    const credits = parseStatementCsv(
      csvOf([['2026-08-01', '10:00', 'A', '', 300], ['2026-08-02', '10:00', 'B', '', 900]]),
    ).txns;
    expect(StatementAnalysisSchema.parse(analyzeStatement(credits, 'hi')).summary.totalIn).toBe(1200);
  });
});

function spearman(a: number[], b: number[]): number {
  const rank = (xs: number[]) => {
    const order = xs.map((v, i) => [v, i] as const).sort((p, q) => p[0] - q[0]);
    const r = new Array<number>(xs.length);
    for (let i = 0; i < order.length; ) {
      let j = i;
      while (j + 1 < order.length && order[j + 1]![0] === order[i]![0]) j++;
      for (let k = i; k <= j; k++) r[order[k]![1]] = (i + j) / 2 + 1;
      i = j + 1;
    }
    return r;
  };
  const ra = rank(a);
  const rb = rank(b);
  const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
  const ma = mean(ra);
  const mb = mean(rb);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < ra.length; i++) {
    num += (ra[i]! - ma) * (rb[i]! - mb);
    da += (ra[i]! - ma) ** 2;
    db += (rb[i]! - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
}

describe('Isolation Forest', () => {
  it('mulberry32 is repeatable and c(n) follows the formula', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seq = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(seq);
    seq.forEach((v) => expect(v >= 0 && v < 1).toBe(true));
    expect(mulberry32(43)()).not.toBe(seq[0]);
    expect([averagePathLength(1), averagePathLength(2)]).toEqual([0, 1]);
    expect(averagePathLength(256)).toBeCloseTo(2 * (Math.log(255) + 0.5772156649) - (2 * 255) / 256, 12);
  });

  it('gives identical scores on every run and scores an obvious outlier highest', () => {
    const rand = mulberry32(7);
    const rows = Array.from({ length: 200 }, () => [rand(), rand()]);
    rows.push([8, 8]);
    const s1 = isolationForestScores(rows);
    expect(isolationForestScores(rows)).toEqual(s1);
    expect(s1.indexOf(Math.max(...s1))).toBe(200);
    expect(s1[200]).toBeGreaterThan(0.7);
    expect(median(s1)).toBeLessThan(0.5);
    s1.forEach((v) => expect(v > 0 && v < 1).toBe(true));
    expect(isolationForestScores(rows, { seed: 1 })).not.toEqual(s1);
    expect(isolationForestScores([])).toEqual([]);
    expect(isolationForestScores([[1, 2]])).toEqual([0.5]);
    expect(new Set(isolationForestScores([[1], [1], [1]])).size).toBe(1); // identical points cannot be split
  });

  it.each(SAMPLE_STATEMENTS.map((s) => [s.id, s] as const))(
    '%s: features equal the Python ones and scores track scikit-learn (Spearman ≥ 0.8)',
    (id, sample) => {
      const ref = reference[id as keyof typeof reference];
      const debits = debitInfo(parseStatementCsv(sample.csv).txns);
      expect(debits.map((d) => d.txn.id)).toEqual(ref.ids);
      const rows = forestRows(debits, true);
      rows.forEach((row, i) => row.forEach((v, k) => expect(v, id + ' row ' + i + ' col ' + k).toBeCloseTo(ref.features[i]![k]!, 6)));
      const rho = spearman(isolationForestScores(rows), ref.sklearn);
      console.info('isolation forest vs scikit-learn, ' + id + ': Spearman ' + rho.toFixed(3) + ' over ' + rows.length + ' debits');
      expect(rho).toBeGreaterThanOrEqual(0.8);
    },
  );

  it('leaves the hour columns out when the statement has no times', () => {
    const p = parseStatementCsv('Date,Narration,Amount,Dr/Cr,Balance\n01/08/2026,UPI/DR/SWIGGY,300,Dr,1\n');
    expect(forestRows(debitInfo(p.txns), false)[0]).toHaveLength(6);
  });

  it('flags a one-off payment that fits no rule', () => {
    // ₹4,000 by card at 07:00 to a payee seen once: under every rule threshold, unlike anything else here
    const csv = csvOf(byTime([...ordinary(), ['2026-08-20', '07:00', 'One Off Store', 4000]]));
    const a = analyzeStatement(parseStatementCsv(csv.replace(',UPI,One Off Store', ',CARD,One Off Store')).txns, 'en');
    expect(types(a)).toEqual(['isolation_outlier']);
    expect(a.anomalies[0]!.severity).toMatch(/low|medium/);
    expect(a.anomalies[0]!.score).toBeGreaterThanOrEqual(0.62);
    expect(a.anomalies[0]!.features.length).toBeGreaterThan(0);
  });
});

describe('sample statements', () => {
  it('has the three personas, salaried first, all parsing cleanly', () => {
    expect(SAMPLE_STATEMENTS.map((s) => s.id)).toEqual(['salaried', 'student', 'shop']);
    for (const s of SAMPLE_STATEMENTS) {
      expect(Object.keys(s.title).sort()).toEqual(['bn', 'en', 'hi', 'te']);
      expect(s.title.en).toContain('sample');
      const p = ParsedStatementSchema.parse(parseStatementCsv(s.csv));
      expect(p.format).toBe('canonical');
      expect(p.errors).toEqual([]);
      expect(p.txns.length).toBeGreaterThanOrEqual(150);
    }
  });

  it.each(SAMPLE_STATEMENTS.map((s) => [s.id, s] as const))(
    '%s: every injected scenario is flagged, in all languages',
    (id, sample) => {
      const labels = reference[id as keyof typeof reference].labels;
      const txns = parseStatementCsv(sample.csv).txns;
      for (const lang of ['en', 'hi', 'te', 'bn'] as const) {
        const a = StatementAnalysisSchema.parse(analyzeStatement(txns, lang));
        for (const label of labels) {
          const hit = a.anomalies.find((x) => x.txnIds.some((t) => label.txnIds.includes(t)));
          expect(hit, id + ' ' + label.type).toBeDefined();
        }
        expect(a.riskScore).toBeGreaterThanOrEqual(60);
        expect(a.anomalies.length).toBeLessThanOrEqual(4);
        const ids = new Set(txns.map((t) => t.id));
        a.anomalies.forEach((x) => x.txnIds.forEach((t) => expect(ids.has(t)).toBe(true)));
      }
    },
  );

  it('analyses 400 rows well within a second', () => {
    const txns = parseStatementCsv(SAMPLE_STATEMENTS[2]!.csv).txns;
    const t0 = Date.now();
    analyzeStatement(txns, 'en');
    expect(Date.now() - t0).toBeLessThan(1000);
  });
});

describe('buildEntityGraph', () => {
  const scan = (
    riskScore: number,
    e: { upi?: [string, number][]; phones?: string[]; urls?: [string, number, boolean?][] },
  ): AnalysisResult =>
    ({
      riskScore,
      entities: {
        upiIds: (e.upi ?? []).map(([raw, risk]) => ({ raw, risk })),
        phones: (e.phones ?? []).map((raw) => ({ raw })),
        urls: (e.urls ?? []).map(([registrableDomain, risk, isOfficial = false]) => ({
          registrableDomain,
          host: registrableDomain,
          risk,
          isOfficial,
        })),
        amounts: [],
        emails: [],
        apkMentions: [],
        brands: [],
      },
    }) as unknown as AnalysisResult;
  const campaigns = new Set(INDICATORS.flatMap((i) => (i.campaign ? [i.campaign] : [])));

  it('is empty for no history', () => {
    expect(EntityGraphSchema.parse(buildEntityGraph([]))).toEqual({
      nodes: [],
      edges: [],
      stats: { clusters: 0, largestCluster: 0 },
    });
  });

  it('normalises values so the same entity is one node', () => {
    expect(normaliseEntity('phone', '+91 98765-01234')).toBe('+919876501234');
    expect(normaliseEntity('phone', '9876501234')).toBe('+919876501234');
    expect(normaliseEntity('domain', 'HTTPS://WWW.Sbi-Kyc-Update.xyz/verify?x=1')).toBe('sbi-kyc-update.xyz');
    expect(normaliseEntity('upi', ' Refund.Desk@YBL ')).toBe('refund.desk@ybl');
  });

  it('links entities from the same scan, merges duplicates and keeps the highest risk', () => {
    const g = EntityGraphSchema.parse(
      buildEntityGraph([
        scan(90, { upi: [['Refund.Desk@ybl', 80]], phones: ['98765 01234'], urls: [['evil-site.top', 95], ['sbi.co.in', 0, true]] }),
        scan(40, { upi: [['refund.desk@ybl', 30]], phones: ['+91 9876501234'] }),
        scan(70, { upi: [['other.person@okaxis', 10]] }),
      ]),
    );
    expect(g.nodes.map((n) => n.id).sort()).toEqual([
      'domain:evil-site.top',
      'phone:+919876501234',
      'upi:other.person@okaxis',
      'upi:refund.desk@ybl',
    ]);
    const byId = new Map(g.nodes.map((n) => [n.id, n]));
    expect(byId.get('upi:refund.desk@ybl')).toMatchObject({ risk: 80, mine: true, sampleData: false, reports: 0 });
    expect(byId.get('phone:+919876501234')!.risk).toBe(90);
    expect(g.edges).toHaveLength(3);
    g.edges.forEach((e) => expect(e.kind).toBe('appears_with'));
    expect(g.stats).toEqual({ clusters: 2, largestCluster: 3 });
  });

  it('adds the bundled indicators and one campaign node per campaign', () => {
    const g = EntityGraphSchema.parse(buildEntityGraph([], { includeBundled: true }));
    expect(
      g.nodes
        .filter((n) => n.type === 'campaign')
        .map((n) => n.label)
        .sort(),
    ).toEqual([...campaigns].sort());
    expect(g.nodes).toHaveLength(INDICATORS.length + campaigns.size);
    g.nodes.forEach((n) => expect(n).toMatchObject({ sampleData: true, mine: false }));
    expect(g.edges).toHaveLength(INDICATORS.filter((i) => i.campaign).length);
    g.edges.forEach((e) => {
      expect(e.kind).toBe('part_of');
      expect(e.target.startsWith('campaign:')).toBe(true);
    });
    const kyc = g.nodes.find((n) => n.id === 'campaign:kyc-block-wave')!;
    expect(kyc.reports).toBe(
      INDICATORS.filter((i) => i.campaign === 'kyc-block-wave').reduce((a, i) => a + i.reports, 0),
    );
    expect(g.stats.largestCluster).toBeGreaterThan(5);
  });

  it("joins the user's scans to the bundled network when a value matches", () => {
    const known = INDICATORS[0]!;
    const g = buildEntityGraph([scan(88, { upi: [[known.value.toUpperCase(), 60], ['brand.new@ybl', 20]] })], {
      includeBundled: true,
    });
    const node = g.nodes.find((n) => n.id === 'upi:' + known.value)!;
    expect(node).toMatchObject({ mine: true, sampleData: true, reports: known.reports });
    expect(node.risk).toBeGreaterThanOrEqual(60);
    expect(
      g.edges.some((e) => e.kind === 'appears_with' && [e.source, e.target].includes('upi:brand.new@ybl')),
    ).toBe(true);
    expect(g.nodes).toHaveLength(INDICATORS.length + campaigns.size + 1);
  });

  it('ignores scans without entities', () => {
    expect(buildEntityGraph([{ riskScore: 10 } as unknown as AnalysisResult]).nodes).toEqual([]);
  });
});
