import { describe, expect, it } from 'vitest';
import { toScanRecord } from './db';
import { analyze, type CollectRequestInput } from './engine';
import { priorRequests, requesterOf, sameAmountCount } from './repeatRequests';

const collect = (p: Partial<CollectRequestInput>): CollectRequestInput => ({
  toldYouWillReceive: true,
  contactedFirst: 'them',
  underPressure: true,
  knowRequester: 'no',
  ...p,
});

async function check(c: CollectRequestInput, at: string) {
  const r = await analyze({ kind: 'collect_request', collect: c, lang: 'en' });
  return { ...toScanRecord(r), createdAt: at };
}

describe('repeated collect requests', () => {
  it('finds earlier requests from the same UPI ID, newest first, without the current one', async () => {
    const a = await check(
      collect({ requesterUpi: 'Refund.Desk2026@ybl', amount: 4999 }),
      '2026-11-18T10:00:00Z',
    );
    const b = await check(
      collect({ requesterUpi: 'refund.desk2026@ybl', amount: 4999 }),
      '2026-11-20T10:00:00Z',
    );
    const other = await check(
      collect({ requesterUpi: 'shop.demo@okaxis', amount: 200 }),
      '2026-11-19T10:00:00Z',
    );
    const now = await check(
      collect({ requesterUpi: 'refund.desk2026@ybl', amount: 4999 }),
      '2026-11-22T10:00:00Z',
    );
    expect(requesterOf(now.result)).toBe('refund.desk2026@ybl');
    const prior = priorRequests('refund.desk2026@ybl', [a, b, other, now], now.id);
    expect(prior.map((p) => p.scanId)).toEqual([b.id, a.id]);
    expect(prior[0]!.amount).toBe(4999);
    expect(sameAmountCount(prior, 4999)).toBe(2);
    expect(sameAmountCount(prior, 100)).toBe(0);
    expect(sameAmountCount(prior, null)).toBe(0);
  });

  it('counts only collect-request checks, and needs a real UPI ID', async () => {
    const msg = await analyze({
      kind: 'message',
      text: 'Approve the collect request from refund.desk2026@ybl to get your refund',
      lang: 'en',
    });
    expect(requesterOf(msg)).toBeNull();
    expect(priorRequests('refund.desk2026@ybl', [toScanRecord(msg)])).toEqual([]);
    expect(priorRequests('not a upi', [toScanRecord(msg)])).toEqual([]);
  });
});
