import { describe, expect, it } from 'vitest';
import { makePreview, toScanRecord } from './db';
import { analyze } from './engine';

describe('db helpers', () => {
  it('makes a one-line preview with an ellipsis', () => {
    expect(makePreview('  hello\n\nworld  ')).toBe('hello world');
    const long = 'a'.repeat(200);
    const p = makePreview(long, 20);
    expect(p).toHaveLength(20);
    expect(p.endsWith('…')).toBe(true);
  });

  it('builds a scan record from an analysis result', async () => {
    const result = await analyze({
      kind: 'message',
      text: 'Your account will be blocked today, update KYC now',
      lang: 'en',
    });
    const rec = toScanRecord(result);
    expect(rec).toMatchObject({
      id: result.id,
      kind: result.kind,
      verdict: result.verdict,
      riskScore: result.riskScore,
    });
    expect(rec.inputPreview.length).toBeLessThanOrEqual(120);
    expect(rec.result).toBe(result);
  });
});
