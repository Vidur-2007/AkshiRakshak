import { describe, expect, it } from 'vitest';
import { toScanRecord, type BlockEntry } from './db';
import { analyze, parseStatementCsv, SAMPLE_STATEMENTS, type Txn } from './engine';
import {
  buildEvidence,
  groupLinks,
  linkTransactions,
  normalise,
  paymentsFor,
  resultDetails,
  txnDetails,
} from './crossLinks';

const txn = (p: Partial<Txn>): Txn => ({
  id: p.id ?? 't1',
  date: p.date ?? '2026-11-12T10:00:00',
  hasTime: true,
  description: p.description ?? '',
  amount: p.amount ?? 4999,
  direction: p.direction ?? 'debit',
  channel: 'UPI',
  category: 'other',
  ...p,
});

const REFUND =
  'Your refund of Rs 4,999 is approved. Accept the collect request from refund.desk2026@ybl and enter your UPI PIN to receive it. Call 98765 43210.';

describe('details', () => {
  it('reads UPI IDs and numbers from a statement row, not bank reference numbers', () => {
    const d = txnDetails(
      txn({
        upiId: 'Refund.Desk2026@YBL',
        description: 'UPI/DR/917654321098/REFUND DESK/refund.desk2026@ybl/call 98765 43210',
      }),
    );
    expect(d).toEqual([
      { type: 'upi', value: 'refund.desk2026@ybl' },
      { type: 'phone', value: '+919876543210' },
    ]);
    // a number inside a UPI ID is that UPI ID
    expect(txnDetails(txn({ description: 'UPI/DR/9876500001@ybl' }))).toEqual([
      { type: 'upi', value: '9876500001@ybl' },
    ]);
    expect(normalise('phone', '+91 98765-43210')).toBe('+919876543210');
    expect(normalise('phone', '12345')).toBeNull();
    expect(normalise('upi', 'not a upi')).toBeNull();
  });
});

describe('linkTransactions', () => {
  it('links a payment to a UPI ID from a scam you checked, as the most serious kind', async () => {
    const r = await analyze({ kind: 'message', text: REFUND, lang: 'en' });
    expect(resultDetails(r).map((d) => d.value)).toContain('refund.desk2026@ybl');
    const evidence = buildEvidence([toScanRecord(r)], []);
    const links = linkTransactions(
      [
        txn({ id: 'a', upiId: 'refund.desk2026@ybl' }),
        txn({ id: 'b', upiId: 'friend.demo@okaxis' }),
        txn({ id: 'c', upiId: 'refund.desk2026@ybl', direction: 'credit', amount: 1 }),
      ],
      evidence,
    );
    expect(links.map((l) => l.txn.id)).toEqual(['a', 'c']);
    expect(links[0]!.level).toBe('high');
    expect(links[0]!.sources[0]).toMatchObject({ kind: 'check', verdict: r.verdict });
    expect(links[1]!.level).toBe('medium'); // money in, not out
  });

  it('ignores checks with no warning signs, and uses the blocklist', async () => {
    const ok = await analyze({
      kind: 'message',
      text: 'Paid Rs 200 to friend.demo@okaxis for lunch. Thanks!',
      lang: 'en',
    });
    const blocked: BlockEntry[] = [
      { value: '+919123456780', type: 'phone', addedAt: '2026-11-01T00:00:00Z' },
    ];
    const evidence = buildEvidence(ok.verdict === 'no_signs' ? [toScanRecord(ok)] : [], blocked);
    const links = linkTransactions(
      [
        txn({ id: 'x', upiId: 'friend.demo@okaxis' }),
        txn({ id: 'y', description: 'IMPS to 91234 56780' }),
      ],
      evidence,
    );
    expect(links.map((l) => [l.txn.id, l.sources[0]!.kind, l.level])).toEqual([
      ['y', 'blocklist', 'high'],
    ]);
  });

  it('finds the sample scam data in the student sample statement', () => {
    const student = SAMPLE_STATEMENTS.find((s) => s.id === 'student')!;
    const { txns } = parseStatementCsv(student.csv);
    const links = linkTransactions(txns, new Map());
    const values = links.map((l) => l.detail.value);
    expect(values).toContain('refund.desk2026@ybl');
    expect(values).toContain('task.payout.hr@ybl');
    for (const l of links) {
      expect(l.sources.every((s) => s.kind === 'indicator')).toBe(true);
      expect(l.level).toBe('medium'); // sample data alone is never the most serious kind
    }
  });
});

describe('groupLinks', () => {
  it('puts the payments to one UPI ID together, with totals in and out', () => {
    const student = SAMPLE_STATEMENTS.find((s) => s.id === 'student')!;
    const groups = groupLinks(linkTransactions(parseStatementCsv(student.csv).txns, new Map()));
    const values = groups.map((g) => g.detail.value);
    expect(new Set(values).size).toBe(values.length);
    const task = groups.find((g) => g.detail.value === 'task.payout.hr@ybl')!;
    expect(task.txns.length).toBeGreaterThan(1);
    expect(task.paidOut).toBe(
      task.txns.filter((x) => x.direction === 'debit').reduce((a, x) => a + x.amount, 0),
    );
    // oldest first
    expect([...task.txns].sort((a, b) => a.date.localeCompare(b.date))).toEqual(task.txns);
    const refund = groups.find((g) => g.detail.value === 'refund.desk2026@ybl')!;
    expect(refund.paidOut).toBeGreaterThan(0);
    expect(refund.paidIn).toBeGreaterThan(0); // the ₹1 "test" credit before the big debit
  });
});

describe('paymentsFor', () => {
  it('finds earlier payments to a checked scam in uploaded statements, once each', async () => {
    const r = await analyze({ kind: 'message', text: REFUND, lang: 'en' });
    const paid = txn({ id: 'p', upiId: 'refund.desk2026@ybl', amount: 4999 });
    const st = (id: string) => ({
      id,
      name: `${id}.csv`,
      analysis: { txns: [paid, txn({ id: 'q' })] },
    });
    const found = paymentsFor(r, [st('one'), st('two')]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      statementName: 'one.csv',
      detail: { value: 'refund.desk2026@ybl' },
    });
    expect(
      paymentsFor({ entities: { ...r.entities, upiIds: [], phones: [] } }, [st('one')]),
    ).toEqual([]);
  });
});
