import { beforeEach, describe, expect, it, vi } from 'vitest';
import { personalTips } from './dashboard';
import { analyze, SAMPLE_MESSAGES } from './engine';
import { DEFAULT_PREFS, applyUrlFlags, useAppStore } from './store';
import { DEMO_SAMPLE_ORDER, orderSamples } from './demo';
import { useSession } from './session';
import { applyStepMode, captionAtTop, STEP_MS, TOUR_SAMPLE_ID, TOUR_STEPS, useTour } from './tour';

const clearHistory = vi.fn(async () => undefined);
vi.mock('./db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  clearHistory: () => clearHistory(),
}));

describe('judge tour', () => {
  beforeEach(() => {
    useAppStore.setState({ ...DEFAULT_PREFS });
    useTour.setState({ active: false, index: 0, saved: null });
  });

  it('follows §5.17: fake KYC, reveal, collect + PIN, QR x-ray, Proof, Elder STOP', () => {
    expect(TOUR_STEPS.map((s) => s.id)).toEqual([
      'kyc',
      'reveal',
      'collect',
      'qr',
      'proof',
      'elder',
    ]);
    expect(STEP_MS).toBeGreaterThanOrEqual(8000);
    expect(STEP_MS).toBeLessThanOrEqual(12000);
  });

  it('uses only bundled samples', () => {
    expect(SAMPLE_MESSAGES.some((s) => s.id === TOUR_SAMPLE_ID)).toBe(true);
    for (const step of TOUR_STEPS) {
      const { path } = step.to('KYC TEXT');
      expect(path.startsWith('/')).toBe(true);
      expect(path).not.toMatch(/^\/\//);
    }
    expect(TOUR_STEPS[1]!.to('KYC TEXT').state).toEqual({ prefill: 'KYC TEXT', autoScan: true });
  });

  it('restores Elder mode and voice when the tour ends', () => {
    useAppStore.getState().setVoiceAuto(false);
    useTour.getState().start();
    for (const step of TOUR_STEPS) {
      applyStepMode(step);
      expect(useAppStore.getState().elderMode).toBe(!!step.elder);
    }
    expect(useAppStore.getState().voiceAuto).toBe(true); // Elder mode turned voice on
    for (let i = 0; i < TOUR_STEPS.length; i++) useTour.getState().next();
    expect(useTour.getState().active).toBe(false);
    expect(useAppStore.getState()).toMatchObject({ elderMode: false, voiceAuto: false });
  });

  it('keeps an Elder-mode user in Elder mode after Skip', () => {
    useAppStore.getState().setElderMode(true);
    useTour.getState().start();
    expect(useAppStore.getState().elderMode).toBe(false); // the tour starts in the full view
    useTour.getState().end();
    expect(useAppStore.getState().elderMode).toBe(true);
  });

  it('puts the caption above a target in the lower half of the screen', () => {
    expect(captionAtTop(null, 800)).toBe(false);
    expect(captionAtTop({ top: 100, bottom: 300 }, 800)).toBe(false);
    expect(captionAtTop({ top: 500, bottom: 700 }, 800)).toBe(true);
  });
});

describe('?demo=1', () => {
  beforeEach(() => {
    useAppStore.setState({ ...DEFAULT_PREFS, elderMode: true });
    useSession.setState({ demo: false });
    clearHistory.mockClear();
  });

  it('puts the script samples first without changing any sample', () => {
    const ordered = orderSamples(SAMPLE_MESSAGES, true);
    expect(ordered.slice(0, DEMO_SAMPLE_ORDER.length).map((s) => s.id)).toEqual([
      ...DEMO_SAMPLE_ORDER,
    ]);
    expect(new Set(ordered)).toEqual(new Set(SAMPLE_MESSAGES)); // same objects, same text
    expect(orderSamples(SAMPLE_MESSAGES, false)).toEqual(SAMPLE_MESSAGES);
  });

  it('gives every sample the same verdict and score in either order', async () => {
    const run = (list: typeof SAMPLE_MESSAGES) =>
      Promise.all(
        list.map(async (s) => {
          const r = await analyze({ kind: s.kind, text: s.text, lang: 'en' });
          return [s.id, r.verdict, r.riskScore] as const;
        }),
      );
    const plain = new Map((await run(SAMPLE_MESSAGES)).map(([id, ...v]) => [id, v]));
    const demo = new Map(
      (await run(orderSamples(SAMPLE_MESSAGES, true))).map(([id, ...v]) => [id, v]),
    );
    expect(demo).toEqual(plain);
  });

  it('clears history once, turns Elder mode off and marks the session', async () => {
    applyUrlFlags('?demo=1');
    applyUrlFlags('?demo=1&lang=en'); // a later route change does not clear again
    await vi.waitFor(() => expect(clearHistory).toHaveBeenCalledTimes(1));
    expect(useSession.getState().demo).toBe(true);
    expect(useAppStore.getState().elderMode).toBe(false);
  });
});

describe('personal tips (M11.6)', () => {
  const rec = (verdict: 'scam' | 'suspicious' | 'no_signs', ids: string[]) => ({
    verdict,
    result: { signals: ids.map((id) => ({ id, weight: 20 })) } as never,
  });

  it('asks for a first check when history is empty', () => {
    expect(personalTips([], false)).toEqual([{ id: 'start', count: 0 }]);
  });

  it('ranks patterns from flagged checks only, then the contact nudge', () => {
    const tips = personalTips(
      [
        rec('scam', ['ASKS_OTP', 'SUSPICIOUS_LINK']),
        rec('suspicious', ['SUSPICIOUS_LINK']),
        rec('scam', ['LOOKALIKE_DOMAIN']),
        rec('no_signs', ['ASKS_OTP']),
      ],
      false,
    );
    expect(tips).toEqual([
      { id: 'links', count: 3 },
      { id: 'codes', count: 1 },
      { id: 'contact', count: 0 },
    ]);
    expect(personalTips([rec('scam', ['ASKS_OTP'])], true)).toEqual([{ id: 'codes', count: 1 }]);
  });
});
