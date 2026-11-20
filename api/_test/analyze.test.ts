/**
 * POST /api/analyze — the developer sandbox: the on-device engine run on the server, with no AI,
 * no link expansion and no domain lookup.
 */
import { AnalysisResultSchema } from '@akshi/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as analyzeApi } from '../analyze.js';
import { resetRateLimits } from '../_lib/ratelimit.js';

const req = (body: unknown, raw = false) =>
  new Request('http://localhost/api/analyze', {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.9', 'content-type': 'application/json' },
    body: raw ? String(body) : JSON.stringify(body),
  });

const KYC =
  'Dear Customer, your SBI account will be BLOCKED today due to pending KYC. Update KYC immediately at http://sbi-kyc-update.xyz/verify and share the OTP you receive.';

beforeEach(() => resetRateLimits());
afterEach(() => vi.unstubAllGlobals());

describe('POST /api/analyze', () => {
  it('returns a contract-valid result with the attack story and tactics, offline', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const res = await analyzeApi(req({ text: KYC, lang: 'en' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result: unknown;
      attackStory: { stage: string; text: string }[];
      tactics: { tactic: string }[];
    };
    const result = AnalysisResultSchema.parse(body.result);
    expect(result.verdict).toBe('scam');
    expect(result.aiUsed).toBe(false);
    expect(body.attackStory.length).toBeGreaterThanOrEqual(3);
    expect(body.tactics.map((t) => t.tactic)).toContain('fear');
    expect(fetchSpy).not.toHaveBeenCalled(); // no AI, no link expansion, no domain lookup
  });

  it('detects the input kind, and accepts an explicit one', async () => {
    const link = await analyzeApi(req({ text: 'http://sbi-kyc-update.xyz/verify' }));
    expect(((await link.json()) as { result: { kind: string } }).result.kind).toBe('url');
    const upi = await analyzeApi(req({ text: 'refund.desk@ybl', kind: 'upi_id', lang: 'hi' }));
    const r = ((await upi.json()) as { result: { kind: string; lang: string } }).result;
    expect([r.kind, r.lang]).toEqual(['upi_id', 'hi']);
  });

  it('never calls a genuine message safe', async () => {
    const res = await analyzeApi(
      req({ text: '482913 is your OTP. Do not share your OTP with anyone.', lang: 'en' }),
    );
    const { result } = (await res.json()) as { result: { verdict: string; explanation: string } };
    expect(result.verdict).toBe('no_signs');
    expect(result.explanation).not.toMatch(/\bsafe\b/i);
  });

  it('refuses bad bodies with a usage hint', async () => {
    for (const body of [
      {},
      { text: '' },
      { text: '   ' },
      { text: 'x'.repeat(20_001) },
      { text: 'hi', lang: 'fr' },
      { text: 'hi', kind: 'image' },
    ]) {
      const res = await analyzeApi(req(body));
      expect(res.status, JSON.stringify(body).slice(0, 40)).toBe(400);
      expect(((await res.json()) as { error: { message: string } }).error.message).toContain(
        '"text"',
      );
    }
    expect((await analyzeApi(req('not json', true))).status).toBe(400);
  });

  it('is rate limited at 30 per minute', async () => {
    for (let i = 0; i < 30; i++) await analyzeApi(req({}));
    const res = await analyzeApi(req({}));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBeTruthy();
  });
});
