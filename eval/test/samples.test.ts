import { describe, expect, it } from 'vitest';
import { SAMPLE_MESSAGES } from '@akshi/content';
import { analyze, warmup } from '@akshi/engine';

/**
 * Every "Try a sample" message gets the verdict its card promises, from the real engine and model, fully
 * offline (no AI, no network lookups) — the way a judge sees it with the phone in airplane mode.
 */
describe('SAMPLE_MESSAGES on the real engine', () => {
  it.each(SAMPLE_MESSAGES.map((s) => [s.id, s] as const))('%s gets its expected verdict', async (_id, s) => {
    await warmup(s.lang);
    const r = await analyze({
      kind: s.kind,
      text: s.text,
      lang: s.lang,
      options: { cloudAI: false, expandLinks: false, domainAge: false },
    });
    expect(r.verdict, s.id + ' scored ' + r.riskScore).toBe(s.expected);
    if (s.genuine) expect(r.verdict).toBe('no_signs');
  });
});
