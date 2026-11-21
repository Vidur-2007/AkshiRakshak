import { describe, expect, it } from 'vitest';
import { analyzeStatement, parseStatementCsv, SAMPLE_STATEMENTS, type Txn } from './engine';
import { inHours, profileOf } from './txnProfile';

const txn = (id: string, date: string, amount: number, upiId: string, hasTime = true): Txn => ({
  id,
  date,
  hasTime,
  description: `UPI/DR/${upiId}`,
  amount,
  direction: 'debit',
  channel: 'UPI',
  category: 'other',
  upiId,
});

const baseline = {
  medianDebit: 1200,
  p90Debit: 3000,
  usualHours: [8, 22] as [number, number],
  frequentPayees: [],
};

describe('profileOf', () => {
  it('puts a large first-time payment at an odd hour next to your usual', () => {
    const txns = [
      txn('a', '2026-11-01T10:00:00', 1100, 'shop.demo@okaxis'),
      txn('b', '2026-11-02T11:00:00', 1300, 'shop.demo@okaxis'),
      txn('x', '2026-11-05T01:34:00', 48000, 'new.payee.demo@ybl'),
    ];
    const p = profileOf({ txnIds: ['x'], score: 0.94 }, { txns, baseline })!;
    expect(p).toMatchObject({
      amount: 48000,
      count: 1,
      typical: 1200,
      times: 40,
      paidBefore: 0,
      regular: false,
      hour: 1,
      unusualHour: true,
      score: 94,
    });
  });

  it('sums a pattern of payments, and knows a regular recipient', () => {
    const txns = [
      txn('a', '2026-11-01T10:00:00', 1100, 'shop.demo@okaxis'),
      txn('b', '2026-11-03T12:00:00', 499, 'shop.demo@okaxis'),
      txn('c', '2026-11-03T12:01:00', 499, 'shop.demo@okaxis'),
    ];
    const p = profileOf({ txnIds: ['b', 'c'], score: 0.5 }, { txns, baseline })!;
    expect(p).toMatchObject({ amount: 998, count: 2, paidBefore: 1, regular: false });
    const more = [
      txn('p1', '2026-10-01T10:00:00', 900, 'shop.demo@okaxis'),
      txn('p2', '2026-10-08T10:00:00', 900, 'shop.demo@okaxis'),
      ...txns,
    ];
    expect(profileOf({ txnIds: ['b', 'c'], score: 0.5 }, { txns: more, baseline })!.regular).toBe(
      true,
    );
    expect(p.unusualHour).toBe(false);
  });

  it('a burst to someone new is first time, not "regular", even with many payments', () => {
    const txns = [
      txn('a', '2026-11-01T10:00:00', 120, 'canteen.demo@okaxis'),
      txn('b1', '2026-11-03T21:10:00', 499, 'task.payout.hr@ybl'),
      txn('b2', '2026-11-03T21:13:00', 499, 'task.payout.hr@ybl'),
      txn('b3', '2026-11-03T21:17:00', 499, 'task.payout.hr@ybl'),
      txn('b4', '2026-11-03T21:22:00', 499, 'task.payout.hr@ybl'),
    ];
    const p = profileOf({ txnIds: ['b1', 'b2', 'b3', 'b4'], score: 0.9 }, { txns, baseline })!;
    expect(p).toMatchObject({ count: 4, amount: 1996, paidBefore: 0, regular: false });
  });

  it('leaves out what it cannot know', () => {
    const txns = [txn('x', '2026-11-05T00:00:00', 500, 'a.demo@ybl', false)];
    const p = profileOf(
      { txnIds: ['x'], score: 2 },
      { txns, baseline: { ...baseline, medianDebit: 0, usualHours: null } },
    )!;
    expect(p.times).toBeNull();
    expect(p.hour).toBeNull();
    expect(p.unusualHour).toBeNull();
    expect(p.score).toBe(100);
    expect(profileOf({ txnIds: ['nope'], score: 0.5 }, { txns, baseline })).toBeNull();
  });

  it('works on every anomaly of the sample statements', () => {
    for (const s of SAMPLE_STATEMENTS) {
      const a = analyzeStatement(parseStatementCsv(s.csv).txns, 'en');
      for (const an of a.anomalies) {
        const p = profileOf(an, a);
        if (!p) continue; // credit-only patterns have no payment out
        expect(p.amount).toBeGreaterThan(0);
        expect(p.typical).toBe(a.baseline.medianDebit);
        expect(p.score).toBeGreaterThanOrEqual(0);
        expect(p.score).toBeLessThanOrEqual(100);
      }
    }
  });

  it('handles usual hours that run past midnight', () => {
    expect(inHours(23, [22, 2])).toBe(true);
    expect(inHours(1, [22, 2])).toBe(true);
    expect(inHours(12, [22, 2])).toBe(false);
    expect(inHours(12, [8, 22])).toBe(true);
  });
});
