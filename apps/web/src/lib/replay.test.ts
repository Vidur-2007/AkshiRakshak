import { describe, expect, it } from 'vitest';
import { analyze, type Signal } from './engine';
import { buildReplay, sentenceCase } from './replay';

const KYC =
  'Dear Customer, your SBI account will be BLOCKED today due to pending KYC. Update KYC immediately at http://sbi-kyc-update.xyz/verify or call our helpline 98765 00001. -SBI Team';
const OTP =
  'This is CBI officer. A case is registered against your Aadhaar. Do not tell anyone. Share the OTP sent to your phone now or you will be arrested today.';

const sig = (id: Signal['id'], weight: number, span?: [number, number]): Signal => ({
  id,
  weight,
  label: id,
  detail: id,
  source: 'rule',
  spans: span ? [{ start: span[0], end: span[1], text: '' }] : [],
});

describe('buildReplay', () => {
  it('replays a fake KYC message in attack order, quoting the message', async () => {
    const r = await analyze({ kind: 'message', text: KYC, lang: 'en' });
    const replay = buildReplay(r, 'en');
    expect(replay).not.toBeNull();
    const stages = replay!.steps.map((s) => s.stage);
    expect(stages[0]).toBe('hook');
    expect(stages).toContain('pressure');
    // attack order is kept
    const order = ['hook', 'pressure', 'compromise', 'extraction'];
    expect([...stages].sort((a, b) => order.indexOf(a) - order.indexOf(b))).toEqual(stages);
    // every quote is really in the message
    for (const s of replay!.steps) if (s.quote) expect(KYC).toContain(s.quote.replace(/…$/, ''));
    // the warning comes before the first step that asks you to act
    expect(['compromise', 'extraction']).toContain(replay!.steps[replay!.stopAt]?.stage);
  });

  it('ends with what the scam is after when it asks for a code', async () => {
    const r = await analyze({ kind: 'message', text: OTP, lang: 'en' });
    const replay = buildReplay(r, 'en')!;
    expect(replay.steps.at(-1)?.stage).toBe('extraction');
    expect(replay.goal).toBe('money');
    // each tactic is shown once, at the first step that uses it
    const all = replay.steps.flatMap((s) => s.tactics);
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBeGreaterThan(0);
  });

  it('works in Hindi', async () => {
    const r = await analyze({ kind: 'message', text: OTP, lang: 'hi' });
    const replay = buildReplay(r, 'hi')!;
    expect(replay.steps.some((s) => /[ऀ-ॿ]/.test(s.text))).toBe(true);
  });

  it('shows nothing without a sequence or when no warning signs were found', () => {
    const text = 'Your SBI account will be blocked';
    expect(
      buildReplay({ verdict: 'suspicious', signals: [sig('THREAT_BLOCK', 0.4)], text }, 'en'),
    ).toBeNull();
    expect(
      buildReplay(
        {
          verdict: 'no_signs',
          signals: [sig('BANK_IMPERSONATION', 0.3), sig('URGENCY', 0.2)],
          text,
        },
        'en',
      ),
    ).toBeNull();
  });

  it('ignores signals that lower the risk, and closes on the warning when nothing is asked yet', () => {
    const text = 'SBI: your account will be blocked today';
    const replay = buildReplay(
      {
        verdict: 'suspicious',
        signals: [
          sig('BANK_IMPERSONATION', 0.3, [0, 3]),
          sig('THREAT_BLOCK', 0.4, [5, 39]),
          sig('ASKS_OTP', -0.2),
        ],
        text,
      },
      'en',
    )!;
    expect(replay.steps.map((s) => s.stage)).toEqual(['hook', 'pressure']);
    expect(replay.steps[0]!.quote).toBe('SBI');
    expect(replay.stopAt).toBe(2);
    expect(replay.goal).toBeNull();
  });

  it('shortens long quotes', () => {
    const text = 'x'.repeat(200);
    const replay = buildReplay(
      {
        verdict: 'scam',
        signals: [sig('BANK_IMPERSONATION', 0.3, [0, 200]), sig('ASKS_OTP', 0.5)],
        text,
      },
      'en',
    )!;
    expect(replay.steps[0]!.quote!.length).toBeLessThanOrEqual(70);
    expect(replay.steps[0]!.quote!.endsWith('…')).toBe(true);
  });

  it('sentenceCase capitalises the first letter only', () => {
    expect(sentenceCase('pretends to be your bank')).toBe('Pretends to be your bank');
    expect(sentenceCase('बैंक')).toBe('बैंक');
  });
});
