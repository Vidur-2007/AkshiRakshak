/**
 * Attack story, manipulation tactics and the message-level claim rows (new-features Phase 2).
 */
import { AnalysisResultSchema, LANGS, type Lang } from '@akshi/contracts';
import { describe, expect, it } from 'vitest';
import { loadAllStrings, TACTICS, TEMPLATE_KEYS } from '../src/i18n';
import { analyze, attackStory, manipulationTactics } from '../src/index';
import { ATTACK_STAGES } from '../src/pipeline/story';

const STRINGS = await loadAllStrings();

async function run(text: string, lang: Lang = 'en') {
  return AnalysisResultSchema.parse(
    await analyze({
      kind: 'message',
      text,
      lang,
      options: { expandLinks: false, domainAge: false, layers: { indicators: false } },
    }),
  );
}

const KYC =
  'Dear Customer, your SBI account will be BLOCKED today due to pending KYC. Update KYC immediately at http://sbi-kyc-update.xyz/verify and share the OTP you receive.';
const ARREST =
  'This is Inspector Sharma from Mumbai Police. A case is registered against you. This is a confidential investigation, do not tell your family. Stay on this video call and pay the security deposit to rajesh.k77@okaxis.';
const REFUND =
  'Your refund of Rs 4,999 is approved. Enter your UPI PIN to receive the money from refund.desk@ybl now.';

describe('attack story', () => {
  it('tells a multi-stage scam as a sequence, after the existing explanation', async () => {
    const r = await run(KYC);
    const steps = attackStory(r.signals, 'en');
    expect(steps.map((s) => s.stage)).toEqual(
      ATTACK_STAGES.filter((st) => steps.some((s) => s.stage === st)),
    );
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(r.explanation).toMatch(/How this scam works: .+ → .+ → .+\.$/);
    // Elder mode reads the first sentence: it is still the category / reasons sentence
    expect(r.explanation.startsWith('How this scam works')).toBe(false);
  });

  it('tells the story in every language', async () => {
    for (const lang of LANGS) {
      const r = await run(KYC, lang);
      const lead = STRINGS[lang].story!.lead!.split('{steps}')[0]!;
      expect(r.explanation, lang).toContain(lead);
      expect(r.explanation.split('→').length, lang).toBeGreaterThanOrEqual(3);
    }
  });

  it('stays quiet for a single-stage warning and for genuine messages', async () => {
    const one = await run('Hurry, offer ends today!');
    expect(one.explanation).not.toContain('How this scam works');
    const genuine = await run(
      '482913 is your OTP for a transaction of Rs 2,499.00. Do not share your OTP with anyone.',
    );
    expect(genuine.verdict).toBe('no_signs');
    expect(genuine.explanation).not.toContain('How this scam works');
  });

  it('names the manipulation tactics behind a "digital arrest"', async () => {
    const r = await run(ARREST);
    const tactics = manipulationTactics(r.signals, 'en').map((t) => t.tactic);
    expect(tactics).toEqual(expect.arrayContaining(['authority', 'secrecy']));
    expect(manipulationTactics(r.signals, 'hi')[0]!.label).not.toMatch(/[a-z]/);
  });

  it('ignores reassuring signals', () => {
    expect(attackStory([{ id: 'SAFETY_ADVICE', weight: -0.5 }], 'en')).toEqual([]);
    expect(manipulationTactics([{ id: 'URGENCY', weight: -0.1 }], 'en')).toEqual([]);
  });
});

describe('claim vs reality from the message', () => {
  it('shows that a PIN sends the promised amount out, to the UPI ID in the message', async () => {
    const r = await run(REFUND);
    const row = r.claimVsReality.find((c) => c.signal === 'RECEIVE_WITH_PIN');
    expect(row, JSON.stringify(r.claimVsReality)).toBeDefined();
    expect(row!.claim).toBe('You will receive ₹4,999');
    expect(row!.reality).toBe(
      'Entering your UPI PIN sends ₹4,999 from your account to refund.desk@ybl',
    );
    expect(row!.mismatch).toBe(true);
  });

  it('contradicts a police claim that asks for money to a personal UPI ID', async () => {
    const r = await run(ARREST);
    const row = r.claimVsReality.find((c) => c.signal === 'AUTHORITY_CLAIM');
    expect(row, JSON.stringify(r.claimVsReality)).toBeDefined();
    expect(row!.reality).toContain('rajesh.k77@okaxis');
    expect(row!.mismatch).toBe(true);
  });

  it('only calls an unfamiliar number unverified, not a mismatch', async () => {
    const r = await run(
      'This is the cyber crime police department. A complaint is pending against your number. Call 98765 43210 immediately to avoid legal action.',
    );
    const row = r.claimVsReality.find((c) => c.signal === 'AUTHORITY_CLAIM');
    if (row) {
      expect(row.mismatch).toBe(false);
      expect(row.reality).toContain('could not be verified');
    }
  });

  it('adds no message rows to a message with no warning signs', async () => {
    const r = await run('Rs 1,250.00 debited from your account XX0000 by UPI.');
    expect(r.verdict).toBe('no_signs');
    expect(r.claimVsReality.filter((c) => c.signal === 'AUTHORITY_CLAIM')).toEqual([]);
  });
});

describe('story strings', () => {
  it('has the lead, every step phrase, every tactic and the new templates in all four languages', () => {
    const steps = Object.keys(STRINGS.en.story!.steps!);
    for (const lang of LANGS) {
      const s = STRINGS[lang];
      expect(s.story?.lead, lang).toContain('{steps}');
      for (const id of steps) expect(s.story?.steps?.[id as never], `${lang} ${id}`).toBeTruthy();
      for (const t of TACTICS) expect(s.story?.tactics?.[t], `${lang} ${t}`).toBeTruthy();
      for (const k of TEMPLATE_KEYS.filter((k) => /Authority|PinSendsAmount/.test(k)))
        expect(s.templates[k], `${lang} ${k}`).toBeTruthy();
    }
    expect(JSON.stringify(STRINGS.en.story)).not.toMatch(/\bsafe\b/i);
  });
});
