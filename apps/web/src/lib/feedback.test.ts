import { describe, expect, it } from 'vitest';
import { toScanRecord, type FeedbackRecord } from './db';
import { analyze } from './engine';
import { flagged, labelledExamples, summarise } from './feedback';

const fb = (
  scanId: string,
  verdict: FeedbackRecord['verdict'],
  label: FeedbackRecord['label'],
): FeedbackRecord => ({
  scanId,
  at: '2026-11-22T10:00:00Z',
  label,
  verdict,
  riskScore: verdict === 'scam' ? 95 : verdict === 'suspicious' ? 55 : 5,
  kind: 'message',
});

describe('feedback', () => {
  it('counts agreement, possible false alarms and possible misses', () => {
    const s = summarise([
      fb('a', 'scam', 'scam'),
      fb('b', 'suspicious', 'scam'),
      fb('c', 'no_signs', 'legit'),
      fb('d', 'scam', 'legit'),
      fb('e', 'no_signs', 'scam'),
    ]);
    expect(s).toEqual({ total: 5, agreed: 3, falseAlarms: 1, misses: 1 });
    expect(flagged({ verdict: 'suspicious' })).toBe(true);
    expect(summarise([])).toEqual({ total: 0, agreed: 0, falseAlarms: 0, misses: 0 });
  });

  it('joins labels with their checks for download, leaving out deleted checks', async () => {
    const r = await analyze({
      kind: 'message',
      text: 'Your SBI account will be blocked today. Share the OTP now.',
      lang: 'en',
    });
    const scan = toScanRecord(r);
    const examples = labelledExamples(
      [fb(scan.id, r.verdict, 'scam'), fb('deleted-check', 'scam', 'legit')],
      [scan],
    );
    expect(examples).toHaveLength(1);
    expect(examples[0]).toMatchObject({
      label: 'scam',
      text: r.text,
      kind: 'message',
      akshiVerdict: r.verdict,
      category: r.category,
    });
  });
});
