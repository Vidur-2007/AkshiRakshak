import { describe, expect, it } from 'vitest';
import { computeKpis, byDay } from './dashboard';
import { buildSampleHistory, isSampleCheck, samplePlan, SAMPLE_ID_PREFIX } from './sampleHistory';
import { peekResult } from './scan';

describe('dashboard sample history', () => {
  const now = new Date('2026-11-20T12:30:00');

  it('covers every bundled sample message plus a QR, a link and a collect request', () => {
    const kinds = samplePlan().map((p) => p.core.kind);
    expect(kinds).toEqual(expect.arrayContaining(['message', 'qr', 'url', 'collect_request']));
    expect(new Set(samplePlan().map((p) => p.key)).size).toBe(samplePlan().length);
  });

  it('checks them with the real engine, dated in the last two weeks and never in the future', async () => {
    const list = await buildSampleHistory('en', now);
    expect(list.length).toBe(samplePlan().length);
    for (const s of list) {
      expect(isSampleCheck(s.id)).toBe(true);
      expect(s.id.startsWith(SAMPLE_ID_PREFIX)).toBe(true);
      const t = new Date(s.createdAt).getTime();
      expect(t).toBeLessThanOrEqual(now.getTime());
      expect(now.getTime() - t).toBeLessThan(14 * 24 * 3600 * 1000);
      // the feed opens them on the analysis screen from memory, not from saved history
      expect(peekResult(s.id)?.id).toBe(s.id);
    }
    // a realistic mix: scams, and genuine messages with no warning signs
    const verdicts = new Set(list.map((s) => s.verdict));
    expect(verdicts.has('scam')).toBe(true);
    expect(verdicts.has('no_signs')).toBe(true);
    // newest first
    expect([...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))).toEqual(list);
  });

  it('gives the dashboard numbers and a 14-day chart to show', async () => {
    const list = await buildSampleHistory('en', now);
    const k = computeKpis(list);
    expect(k.scans).toBe(list.length);
    expect(k.threats).toBeGreaterThan(5);
    expect(k.moneyAtRisk).toBeGreaterThan(0);
    expect(k.linksAndQrs).toBeGreaterThan(0);
    expect(byDay(list, 14, now).filter((d) => d.scans > 0).length).toBeGreaterThan(8);
  });

  it('is never called the person’s own history', () => {
    expect(isSampleCheck('3f1c9a2e-real-scan-id')).toBe(false);
  });
});
